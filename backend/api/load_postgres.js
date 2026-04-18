import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { parse } from "csv-parse/sync";
import pg from "pg";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const DATA_DIR = path.resolve(__dirname, "../../data/processed");
const RESOLVED_ENTITIES_FILE = path.join(DATA_DIR, "resolved_entities.csv");
const MAPPING_FILE = path.join(DATA_DIR, "source_to_entity_mapping.csv");

function parseCsv(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf8").trim();
  if (!content) return [];

  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function ensureSchemaCompatibility(client) {
  await client.query(`
    ALTER TABLE business_entity
      ADD COLUMN IF NOT EXISTS unified_entity_id VARCHAR(32) UNIQUE,
      ADD COLUMN IF NOT EXISTS pan VARCHAR(32),
      ADD COLUMN IF NOT EXISTS city VARCHAR(128),
      ADD COLUMN IF NOT EXISTS state VARCHAR(128),
      ADD COLUMN IF NOT EXISTS pincode VARCHAR(16),
      ADD COLUMN IF NOT EXISTS source_system_count INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS resolution_quality NUMERIC(5,2) NOT NULL DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS sample_decision_reason TEXT;
  `);

  await client.query(`
    ALTER TABLE source_record_map
      ADD COLUMN IF NOT EXISTS resolution_reason TEXT,
      ADD COLUMN IF NOT EXISTS pan VARCHAR(32),
      ADD COLUMN IF NOT EXISTS name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS address TEXT,
      ADD COLUMN IF NOT EXISTS city VARCHAR(128),
      ADD COLUMN IF NOT EXISTS state VARCHAR(128),
      ADD COLUMN IF NOT EXISTS pincode VARCHAR(16);
  `);
}

async function loadData() {
  const resolvedEntities = parseCsv(RESOLVED_ENTITIES_FILE);
  const mappingRows = parseCsv(MAPPING_FILE);

  const pool = new Pool({
    host: process.env.POSTGRES_HOST || "localhost",
    port: Number(process.env.POSTGRES_PORT || 5432),
    database: process.env.POSTGRES_DB || "omnigraph",
    user: process.env.POSTGRES_USER || "omnigraph",
    password: process.env.POSTGRES_PASSWORD || "omnigraph",
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await ensureSchemaCompatibility(client);

    await client.query("TRUNCATE TABLE source_record_map RESTART IDENTITY");
    await client.query("TRUNCATE TABLE business_entity RESTART IDENTITY CASCADE");

    const distinctSources = [...new Set(mappingRows.map((r) => String(r.source || "").trim()).filter(Boolean))];

    for (const source of distinctSources) {
      await client.query(
        `
          INSERT INTO source_department (department_code, department_name)
          VALUES ($1, $2)
          ON CONFLICT (department_code)
          DO UPDATE SET department_name = EXCLUDED.department_name
        `,
        [source, source]
      );
    }

    const sourceIdRows = await client.query("SELECT id, department_code FROM source_department");
    const sourceIdByCode = new Map(sourceIdRows.rows.map((r) => [r.department_code, r.id]));

    for (const row of resolvedEntities) {
      await client.query(
        `
          INSERT INTO business_entity (
            unified_entity_id,
            canonical_name,
            normalized_name,
            pan,
            city,
            state,
            pincode,
            source_system_count,
            resolution_quality,
            sample_decision_reason,
            status,
            risk_score
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'ACTIVE',0.00)
          ON CONFLICT (unified_entity_id)
          DO UPDATE SET
            canonical_name = EXCLUDED.canonical_name,
            normalized_name = EXCLUDED.normalized_name,
            pan = EXCLUDED.pan,
            city = EXCLUDED.city,
            state = EXCLUDED.state,
            pincode = EXCLUDED.pincode,
            source_system_count = EXCLUDED.source_system_count,
            resolution_quality = EXCLUDED.resolution_quality,
            sample_decision_reason = EXCLUDED.sample_decision_reason,
            updated_at = NOW()
        `,
        [
          row.entity_id,
          row.canonical_name || "UNKNOWN",
          normalizeName(row.canonical_name),
          row.pan || null,
          row.city || null,
          row.state || null,
          row.pincode || null,
          toNumber(row.source_system_count, 0),
          toNumber(row.resolution_quality, 0),
          row.sample_decision_reason || null,
        ]
      );
    }

    const entityRows = await client.query("SELECT id, unified_entity_id FROM business_entity");
    const entityIdByUnifiedId = new Map(entityRows.rows.map((r) => [r.unified_entity_id, r.id]));

    for (const row of mappingRows) {
      const sourceCode = String(row.source || "").trim();
      const sourceDepartmentId = sourceIdByCode.get(sourceCode);
      const businessEntityId = entityIdByUnifiedId.get(row.entity_id) || null;

      await client.query(
        `
          INSERT INTO source_record_map (
            source_department_id,
            source_record_id,
            business_entity_id,
            resolution_tier,
            resolution_confidence,
            resolution_reason,
            pan,
            name,
            address,
            city,
            state,
            pincode,
            raw_payload
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
          ON CONFLICT (source_department_id, source_record_id)
          DO UPDATE SET
            business_entity_id = EXCLUDED.business_entity_id,
            resolution_tier = EXCLUDED.resolution_tier,
            resolution_confidence = EXCLUDED.resolution_confidence,
            resolution_reason = EXCLUDED.resolution_reason,
            pan = EXCLUDED.pan,
            name = EXCLUDED.name,
            address = EXCLUDED.address,
            city = EXCLUDED.city,
            state = EXCLUDED.state,
            pincode = EXCLUDED.pincode,
            raw_payload = EXCLUDED.raw_payload
        `,
        [
          sourceDepartmentId,
          row.source_record_id,
          businessEntityId,
          row.tier || "UNRESOLVED",
          toNumber(row.confidence, 0),
          row.decision_reason || null,
          row.pan || null,
          row.name || null,
          row.address || null,
          row.city || null,
          row.state || null,
          row.pincode || null,
          JSON.stringify(row),
        ]
      );
    }

    await client.query("COMMIT");

    console.log(`Loaded ${resolvedEntities.length} entities into Postgres.`);
    console.log(`Loaded ${mappingRows.length} source mappings into Postgres.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

loadData().catch((error) => {
  console.error("Failed to load Postgres data:", error.message);
  process.exitCode = 1;
});
