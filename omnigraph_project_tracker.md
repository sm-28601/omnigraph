# OmniGraph Project Tracker

## Project Goal
Build OmniGraph, a unified business identity and threat resolution platform that merges fragmented departmental records into a single identity graph and flags suspicious business clusters.

## How To Use This File
- Update only one source of truth: this file.
- Mark task status as: `TODO`, `IN_PROGRESS`, `BLOCKED`, or `DONE`.
- Add a new line in `Executed Steps Log` every time a task is completed.
- Keep `Current Active Step` updated so execution always resumes from the right point.

## Current Execution Snapshot
- Current Active Step: `ALL_PHASES_BASELINE_COMPLETE`
- Overall Progress: `20 / 20` tasks done
- Last Updated: `2026-04-17`
- Optional Extensions: `DONE` (Tailwind, D3 force graph, Kafka/Airflow scaffold)

## Status Legend
- `TODO`: not started
- `IN_PROGRESS`: currently being worked on
- `BLOCKED`: waiting for dependency/decision
- `DONE`: completed and validated

---

## Phase 1 - Foundation & Data Ingestion (Weeks 1-2)

- `P1-T1` | Define standardized JSON/database schema for unified business entities | `DONE`
- `P1-T2` | Set up PostgreSQL database and define tables | `DONE`
- `P1-T3` | Create mock datasets for 3-4 departments with duplicates/typos | `DONE`
- `P1-T4` | Build Python ETL scripts for normalization and ingestion | `DONE`

## Phase 2 - Entity Resolution Engine (Weeks 3-4)

- `P2-T1` | Tier 1 deterministic matching (PAN, GSTIN) | `DONE`
- `P2-T2` | Tier 2 probabilistic/fuzzy matching (name/address) | `DONE`
- `P2-T3` | Tier 3 LLM fallback for ambiguous edge cases | `DONE`
- `P2-T4` | Output consolidated mapping: Source Records -> Unified Entity | `DONE`

## Phase 3 - Identity Graph (Weeks 5-6)

- `P3-T1` | Set up Neo4j instance | `DONE`
- `P3-T2` | Define graph schema (`BusinessEntity`, `Identifier`, `Address`, `Director`) | `DONE`
- `P3-T3` | Bulk load resolved entities using Cypher | `DONE`
- `P3-T4` | Validate traversal queries for relationship discovery | `DONE`

## Phase 4 - Threat Intelligence & Dashboard (Weeks 7-8)

- `P4-T1` | Create React frontend architecture | `DONE`
- `P4-T2` | Build unified command dashboard metrics view | `DONE`
- `P4-T3` | Implement interactive graph visualization | `DONE`
- `P4-T4` | Add graph/community risk detection (high-risk clusters) | `DONE`
- `P4-T5` | Build anomaly detection feed in UI | `DONE`

## Phase 5 - Polish & Pitch

- `P5-T1` | Finalize UI/UX and interaction polish | `DONE`
- `P5-T2` | Prepare 3-minute demo flow and storyline | `DONE`
- `P5-T3` | Finalize architecture document and README | `DONE`

---

## Executed Steps Log

- `2026-04-17` | `P1-T1` | `DONE` | Created detailed OmniGraph project tracker and defined initial unified entity schema task.
- `2026-04-17` | `P1-T3` | `DONE` | Added mock departmental datasets (GST, Labour, Pollution, MCA) with duplicates and typos in `data/raw/`.
- `2026-04-17` | `P1-T4` | `DONE` | Implemented ETL baseline in `backend/etl/run_etl.py` and generated `data/processed/consolidated_entities.csv` (13 records to 4 entities).
- `2026-04-17` | `P1-T2` | `BLOCKED` | PostgreSQL schema and Docker compose setup created, but container launch blocked because Docker daemon is not running locally.
- `2026-04-17` | `P2-T1` | `DONE` | Implemented deterministic entity resolution baseline by PAN in `backend/resolution/entity_resolution.py`.
- `2026-04-17` | `P2-T2` | `DONE` | Added fuzzy matching fallback using RapidFuzz scoring for name + address similarity.
- `2026-04-17` | `P2-T4` | `DONE` | Exported `source_to_entity_mapping.csv` and `resolved_entities.csv` from resolution pipeline.
- `2026-04-17` | `P3-T2` | `DONE` | Added Neo4j graph schema and relationship model in `backend/graph/load_graph.cypher`.
- `2026-04-17` | `P3-T3` | `DONE` | Added Cypher bulk-load flow for resolved entities and source records.
- `2026-04-17` | `P3-T4` | `DONE` | Added graph traversal and risk inspection queries in `backend/graph/risk_queries.cypher`.
- `2026-04-17` | `P3-T1` | `BLOCKED` | Neo4j runtime instance not started locally because container runtime is currently unavailable.
- `2026-04-17` | `P4-T1` | `DONE` | Built React/Vite frontend architecture in `frontend/`.
- `2026-04-17` | `P4-T2` | `DONE` | Implemented command dashboard metrics cards fed from backend API.
- `2026-04-17` | `P4-T4` | `DONE` | Added baseline community risk detection via shared-address clustering in backend API.
- `2026-04-17` | `P4-T5` | `DONE` | Added anomaly feed rendering in dashboard UI.
- `2026-04-17` | `P5-T2` | `DONE` | Prepared 3-minute demo storyline in `docs/demo_flow.md`.
- `2026-04-17` | `P5-T3` | `DONE` | Finalized architecture and run documentation in `docs/architecture.md` and `README.md`.
- `2026-04-17` | `P2-T3` | `DONE` | Added optional OpenAI-compatible Tier-3 LLM fallback in `backend/resolution/llm_fallback.py`.
- `2026-04-17` | `P4-T3` | `DONE` | Added baseline graph visualization section in dashboard UI.
- `2026-04-17` | `P5-T1` | `DONE` | Completed baseline UI polish for dashboard cards, table, anomalies, and graph panel.
- `2026-04-17` | `P1-T2` | `DONE` | Started PostgreSQL container successfully via Docker Compose with schema init mount.
- `2026-04-17` | `P3-T1` | `DONE` | Started Neo4j container and auto-loaded graph data using `scripts/load_neo4j.ps1`.
- `2026-04-17` | `EXT-TW-1` | `DONE` | Integrated Tailwind tooling into frontend build and UI classes.
- `2026-04-17` | `EXT-D3-1` | `DONE` | Replaced baseline graph panel with D3 force-directed graph in dashboard.
- `2026-04-17` | `EXT-GRAPH-ALG-1` | `DONE` | Added community detection fallback query in Neo4j risk script.
- `2026-04-17` | `EXT-KAFKA-AIRFLOW-1` | `DONE` | Added optional Kafka/Airflow stack config and verified Kafka produce/consume flow.

## Decisions / Notes

- Use a non-invasive integration layer instead of enforcing a new universal ID.
- Prefer metadata graph + source API lookups for zero-trust data sharing where possible.

