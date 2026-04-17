# OmniGraph Architecture

## Components

1. Data Sources
- GST
- Labour
- Pollution Control
- MCA

2. Ingestion + Normalization (Python)
- ackend/etl/run_etl.py: baseline normalization and entity rollup.
- ackend/resolution/entity_resolution.py: deterministic + fuzzy mapping.

3. Resolution Layers
- Tier 1 deterministic via PAN.
- Tier 2 fuzzy scoring with RapidFuzz on name/address.
- Tier 3 review-required queue for ambiguous records.

4. Storage
- PostgreSQL schema in ackend/db/schema.sql for source records, mappings, and run logs.
- Neo4j load/query scripts in ackend/graph/.

5. Service/API
- Express API in ackend/api/server.js serving entities, mappings, metrics, and anomalies.

6. Dashboard
- React + Vite in rontend/ rendering command metrics, entities, and anomaly feed.

## Data Flow

Raw CSVs -> Normalization -> Resolution Mapping -> Processed CSV outputs -> API -> Dashboard

## Threat Intelligence Baseline

- Address cluster alerts generated when >=3 records map to the same normalized address.
- Low-confidence record monitoring exposed as dashboard metric.
