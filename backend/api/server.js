import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import pg from "pg";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const DEFAULT_DATA_DIR = path.resolve(__dirname, "../../data/processed");
const PORT = Number(process.env.PORT || 8080);
const API_AUTH_ENABLED = String(process.env.API_AUTH_ENABLED || "false").toLowerCase() === "true";
const API_KEYS = String(process.env.API_KEYS || "");
const API_DATA_SOURCE = String(process.env.API_DATA_SOURCE || "csv").toLowerCase();

const ROLE_RANK = {
  viewer: 1,
  analyst: 2,
  admin: 3,
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

function parseApiKeys(raw) {
  const out = new Map();
  if (!raw.trim()) return out;
  for (const pair of raw.split(",")) {
    const [token, roleRaw] = pair.split(":").map((v) => String(v || "").trim());
    if (!token) continue;
    const role = ROLE_RANK[roleRaw] ? roleRaw : "viewer";
    out.set(token, role);
  }
  return out;
}

function getPaging(req) {
  const pageRaw = Number(req.query.page ?? DEFAULT_PAGE);
  const limitRaw = Number(req.query.limit ?? DEFAULT_LIMIT);

  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : DEFAULT_PAGE;
  const limitBounded = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : DEFAULT_LIMIT;
  const limit = Math.min(limitBounded, MAX_LIMIT);

  return { page, limit };
}

function paginateRows(rows, page, limit) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * limit;
  const data = rows.slice(start, start + limit);
  return {
    total,
    page: safePage,
    limit,
    total_pages: totalPages,
    data,
  };
}

function buildAnomalies(mappingRows) {
  const grouped = new Map();
  for (const row of mappingRows) {
    const key = `${(row.address || "").toLowerCase().trim()}|${row.pincode}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  const anomalies = [];
  for (const [key, rows] of grouped.entries()) {
    if (rows.length >= 3) {
      const [address] = key.split("|");
      anomalies.push({
        type: "ADDRESS_CLUSTER",
        severity: rows.length >= 5 ? "HIGH" : "MEDIUM",
        description: `${rows.length} records linked to a shared address`,
        address,
        record_ids: rows.map((r) => r.source_record_id),
      });
    }
  }
  return anomalies;
}

function parseCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf8").trim();
  if (!content) return [];
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });
}

function createMetricsStore() {
  return {
    requestsTotal: new Map(),
    requestsDurationMsTotal: new Map(),
  };
}

function metricKey(parts) {
  return parts.join("|");
}

function addMetric(map, key, value) {
  map.set(key, (map.get(key) || 0) + value);
}

function parseKey(key) {
  const [method, route, status] = key.split("|");
  return { method, route, status };
}

function renderPrometheusMetrics(metrics) {
  const lines = [];
  lines.push("# HELP omnigraph_http_requests_total Total HTTP requests by method, route, and status.");
  lines.push("# TYPE omnigraph_http_requests_total counter");
  for (const [key, value] of metrics.requestsTotal.entries()) {
    const { method, route, status } = parseKey(key);
    lines.push(
      `omnigraph_http_requests_total{method="${method}",route="${route}",status="${status}"} ${value}`
    );
  }
  lines.push("# HELP omnigraph_http_request_duration_ms_total Accumulated request duration in milliseconds.");
  lines.push("# TYPE omnigraph_http_request_duration_ms_total counter");
  for (const [key, value] of metrics.requestsDurationMsTotal.entries()) {
    const { method, route, status } = parseKey(key);
    lines.push(
      `omnigraph_http_request_duration_ms_total{method="${method}",route="${route}",status="${status}"} ${value.toFixed(3)}`
    );
  }
  return `${lines.join("\n")}\n`;
}

function createApp(options = {}) {
  const dataDir = options.dataDir || process.env.DATA_DIR || DEFAULT_DATA_DIR;
  const dataSource = (options.dataSource || API_DATA_SOURCE || "csv").toLowerCase();
  const authEnabled =
    options.authEnabled !== undefined
      ? options.authEnabled
      : API_AUTH_ENABLED;
  const apiKeys = options.apiKeys || parseApiKeys(API_KEYS);
  const metrics = createMetricsStore();
  const pool =
    dataSource === "postgres"
      ? new Pool({
          host: process.env.POSTGRES_HOST || "localhost",
          port: Number(process.env.POSTGRES_PORT || 5432),
          database: process.env.POSTGRES_DB || "omnigraph",
          user: process.env.POSTGRES_USER || "omnigraph",
          password: process.env.POSTGRES_PASSWORD || "omnigraph",
        })
      : null;

  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.use((req, res, next) => {
    req.requestId = crypto.randomUUID();
    const startedAt = process.hrtime.bigint();
    res.setHeader("x-request-id", req.requestId);
    res.on("finish", () => {
      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const routeLabel = req.route?.path || req.path || "unknown";
      const key = metricKey([req.method, routeLabel, String(res.statusCode)]);
      addMetric(metrics.requestsTotal, key, 1);
      addMetric(metrics.requestsDurationMsTotal, key, elapsedMs);
    });
    next();
  });

  morgan.token("request_id", (req) => req.requestId || "unknown");
  app.use(
    morgan(':method :url :status :response-time ms req_id=:request_id', {
      skip: () => process.env.NODE_ENV === "test",
    })
  );

  function extractToken(req) {
    const authHeader = String(req.header("authorization") || "");
    if (authHeader.toLowerCase().startsWith("bearer ")) {
      return authHeader.slice(7).trim();
    }
    return String(req.header("x-api-key") || "").trim();
  }

  function authenticate(req, res, next) {
    if (!authEnabled) {
      req.auth = { role: "admin", key: "dev-auth-disabled" };
      return next();
    }

    const token = extractToken(req);
    const role = apiKeys.get(token);
    if (!token || !role) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.auth = { role, key: `${token.slice(0, 4)}...` };
    return next();
  }

  function requireRole(minRole) {
    return (req, res, next) => {
      const callerRole = req.auth?.role || "viewer";
      if ((ROLE_RANK[callerRole] || 0) < (ROLE_RANK[minRole] || 0)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      return next();
    };
  }

  async function listEntities(page, limit) {
    if (dataSource !== "postgres") {
      const entities = parseCsv(path.join(dataDir, "resolved_entities.csv"));
      return paginateRows(entities, page, limit);
    }

    const offset = (page - 1) * limit;
    const countResult = await pool.query("SELECT COUNT(*)::int AS total FROM business_entity");
    const total = countResult.rows[0]?.total || 0;
    const rowsResult = await pool.query(
      `
        SELECT
          unified_entity_id AS entity_id,
          canonical_name,
          pan,
          city,
          state,
          pincode,
          source_system_count,
          resolution_quality,
          sample_decision_reason
        FROM business_entity
        ORDER BY unified_entity_id
        LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    return {
      total,
      page: safePage,
      limit,
      total_pages: totalPages,
      data: rowsResult.rows,
    };
  }

  async function listMapping(page, limit) {
    if (dataSource !== "postgres") {
      const mapping = parseCsv(path.join(dataDir, "source_to_entity_mapping.csv"));
      return paginateRows(mapping, page, limit);
    }

    const offset = (page - 1) * limit;
    const countResult = await pool.query("SELECT COUNT(*)::int AS total FROM source_record_map");
    const total = countResult.rows[0]?.total || 0;
    const rowsResult = await pool.query(
      `
        SELECT
          sd.department_code AS source,
          srm.source_record_id,
          be.unified_entity_id AS entity_id,
          srm.resolution_tier AS tier,
          srm.resolution_confidence AS confidence,
          srm.resolution_reason AS decision_reason,
          srm.pan,
          srm.name,
          srm.address,
          srm.city,
          srm.state,
          srm.pincode
        FROM source_record_map srm
        LEFT JOIN source_department sd ON sd.id = srm.source_department_id
        LEFT JOIN business_entity be ON be.id = srm.business_entity_id
        ORDER BY srm.id
        LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    return {
      total,
      page: safePage,
      limit,
      total_pages: totalPages,
      data: rowsResult.rows,
    };
  }

  async function listAllMappingForAnalytics() {
    if (dataSource !== "postgres") {
      return parseCsv(path.join(dataDir, "source_to_entity_mapping.csv"));
    }

    const rowsResult = await pool.query(
      `
        SELECT
          sd.department_code AS source,
          srm.source_record_id,
          srm.resolution_confidence AS confidence,
          srm.address,
          srm.pincode
        FROM source_record_map srm
        LEFT JOIN source_department sd ON sd.id = srm.source_department_id
      `
    );
    return rowsResult.rows;
  }

  app.get("/health", (_, res) => {
    res.json({
      status: "ok",
      service: "omnigraph-api",
      data_dir: dataDir,
      auth_enabled: authEnabled,
      data_source: dataSource,
    });
  });

  app.get("/metrics", (_, res) => {
    res.type("text/plain; version=0.0.4");
    res.send(renderPrometheusMetrics(metrics));
  });

  app.get("/api/auth/me", authenticate, (req, res) => {
    res.json({ role: req.auth.role });
  });

  app.get("/api/entities", authenticate, requireRole("viewer"), async (req, res) => {
    try {
      const { page, limit } = getPaging(req);
      const paged = await listEntities(page, limit);
      res.json({
        count: paged.total,
        page: paged.page,
        limit: paged.limit,
        total_pages: paged.total_pages,
        entities: paged.data,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch entities" });
    }
  });

  app.get("/api/source-mapping", authenticate, requireRole("analyst"), async (req, res) => {
    try {
      const { page, limit } = getPaging(req);
      const paged = await listMapping(page, limit);
      res.json({
        count: paged.total,
        page: paged.page,
        limit: paged.limit,
        total_pages: paged.total_pages,
        mapping: paged.data,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch source mapping" });
    }
  });

  app.get("/api/metrics", authenticate, requireRole("viewer"), async (_, res) => {
    try {
      const entitiesCount =
        dataSource === "postgres"
          ? Number((await pool.query("SELECT COUNT(*)::int AS total FROM business_entity")).rows[0]?.total || 0)
          : parseCsv(path.join(dataDir, "resolved_entities.csv")).length;
      const mapping = await listAllMappingForAnalytics();
      const anomalies = buildAnomalies(mapping);

      const lowConfidenceRecords = mapping.filter((m) => Number(m.confidence || 0) < 0.85).length;
      const sourceSystems = new Set(mapping.map((m) => m.source)).size;

      res.json({
        total_entities: entitiesCount,
        total_source_records: mapping.length,
        source_systems: sourceSystems,
        low_confidence_records: lowConfidenceRecords,
        anomaly_count: anomalies.length,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch metrics" });
    }
  });

  app.get("/api/anomalies", authenticate, requireRole("viewer"), async (req, res) => {
    try {
      const mapping = await listAllMappingForAnalytics();
      const anomalies = buildAnomalies(mapping);
      const { page, limit } = getPaging(req);
      const paged = paginateRows(anomalies, page, limit);
      res.json({
        count: paged.total,
        page: paged.page,
        limit: paged.limit,
        total_pages: paged.total_pages,
        anomalies: paged.data,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch anomalies" });
    }
  });

  return app;
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isMainModule) {
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`OmniGraph API listening on ${PORT}`);
  });
}

export { createApp };
