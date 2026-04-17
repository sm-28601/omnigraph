import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../../data/processed");
const PORT = Number(process.env.PORT || 8080);

const app = express();
app.use(cors());
app.use(express.json());

function parseCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf8").trim();
  if (!content) return [];
  const lines = content.split(/\r?\n/);
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    return headers.reduce((obj, key, idx) => {
      obj[key] = values[idx] ?? "";
      return obj;
    }, {});
  });
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

app.get("/health", (_, res) => {
  res.json({ status: "ok", service: "omnigraph-api" });
});

app.get("/api/entities", (_, res) => {
  const entities = parseCsv(path.join(DATA_DIR, "resolved_entities.csv"));
  res.json({ count: entities.length, entities });
});

app.get("/api/source-mapping", (_, res) => {
  const mapping = parseCsv(path.join(DATA_DIR, "source_to_entity_mapping.csv"));
  res.json({ count: mapping.length, mapping });
});

app.get("/api/metrics", (_, res) => {
  const entities = parseCsv(path.join(DATA_DIR, "resolved_entities.csv"));
  const mapping = parseCsv(path.join(DATA_DIR, "source_to_entity_mapping.csv"));
  const anomalies = buildAnomalies(mapping);

  const lowConfidenceRecords = mapping.filter((m) => Number(m.confidence || 0) < 0.85).length;
  const sourceSystems = new Set(mapping.map((m) => m.source)).size;

  res.json({
    total_entities: entities.length,
    total_source_records: mapping.length,
    source_systems: sourceSystems,
    low_confidence_records: lowConfidenceRecords,
    anomaly_count: anomalies.length,
  });
});

app.get("/api/anomalies", (_, res) => {
  const mapping = parseCsv(path.join(DATA_DIR, "source_to_entity_mapping.csv"));
  res.json({ anomalies: buildAnomalies(mapping) });
});

app.listen(PORT, () => {
  console.log(`OmniGraph API listening on ${PORT}`);
});
