# OmniGraph

End-to-end baseline for unified business identity resolution, graph loading, API serving, and command dashboard visualization.

## Implemented

- PostgreSQL schema at `backend/db/schema.sql`
- Local database orchestration via `docker-compose.yml`
- Mock source datasets in `data/raw/`
- ETL baseline at `backend/etl/run_etl.py`
- Resolution engine (deterministic + fuzzy + review queue) at `backend/resolution/entity_resolution.py`
- Neo4j scripts at `backend/graph/load_graph.cypher` and `backend/graph/risk_queries.cypher`
- Express API at `backend/api/server.js`
- React dashboard at `frontend/src/App.jsx` with Tailwind + D3 force graph

## Quick Start

1) Install Python dependencies:

```bash
python -m pip install -r backend/etl/requirements.txt
python -m pip install -r backend/resolution/requirements.txt
```

2) Generate processed outputs:

```bash
python backend/etl/run_etl.py
python backend/resolution/entity_resolution.py
```

3) Start PostgreSQL (requires Docker daemon running):

```bash
docker compose up -d postgres
```

3b) Start Neo4j and auto-load graph data:

```bash
docker compose up -d neo4j
powershell -ExecutionPolicy Bypass -File .\scripts\load_neo4j.ps1
```

4) Start backend API:

```bash
cd backend/api
npm install
npm start
```

5) Start frontend dashboard:

```bash
cd frontend
npm install
npm run dev
```

## One-command startup

From project root:

```bash
powershell -ExecutionPolicy Bypass -File .\scripts\run_all.ps1
```

This command installs dependencies, regenerates processed outputs, starts PostgreSQL + Neo4j, loads graph scripts, and launches API + frontend.

## Optional Kafka/Airflow stack

Use this if you want streaming ingestion and scheduler scaffolding:

```bash
docker compose -f infra/optional/docker-compose.optional.yml --profile optional up -d
python -m pip install -r backend/streaming/requirements.txt
python backend/streaming/producer.py
python backend/streaming/consumer.py
```

- Kafka broker: `localhost:9092`
- Airflow UI: `http://localhost:8088` (`admin` / `admin`)

## Resolution Behavior

- Reads records from 4 source systems: GST, Labour, Pollution, MCA.
- Tier 1 deterministic merge by PAN.
- Tier 2 fuzzy fallback by name/address similarity.
- Tier 3 review-required tag for ambiguous records.

## Docs

- Architecture: `docs/architecture.md`
- Demo flow: `docs/demo_flow.md`
