# OmniGraph Final Proposal

## Title
OmniGraph: Unified Business Identity and Threat Resolution Network

## Problem Statement
Government departments store business data in isolated systems with inconsistent identifiers and formats. The same entity appears as different records across GST, Labour, Pollution, and MCA systems. This fragmentation causes:
- weak cross-department compliance visibility,
- delayed fraud detection,
- inaccurate business intelligence and policy metrics.

## Core Idea
OmniGraph does not replace departmental systems and does not impose a new universal ID. It links existing identifiers into a single business identity graph using deterministic, fuzzy, and AI-assisted entity resolution.

## Why This Approach Works
- Low resistance: keeps existing departmental workflows intact.
- High utility: provides a cross-department unified view.
- Strong fraud signal quality: graph relationships expose hidden entity clusters.

## Architecture
[Department Sources] -> [Ingestion and Standardization] -> [Entity Resolution Engine] -> [Identity Graph] -> [Unified API + Dashboard]

### Modules
1. Ingestion and Normalization
- Multi-source CSV ingestion from GST, Labour, Pollution, MCA.
- Standardized names, addresses, and identifiers.

2. Entity Resolution Engine
- Tier 1 deterministic matching using PAN/GSTIN confidence rules.
- Tier 2 fuzzy matching for naming/address variation.
- Tier 3 optional LLM fallback for ambiguous edge cases.

3. Identity Graph
- Neo4j graph model with entities, source records, and address links.
- Cypher load and risk query scripts for relationship traversal.

4. Command Dashboard
- Metrics: entities, records, anomaly count, low-confidence records.
- Unified entities table and anomaly feed.
- Baseline graph view for relationship inspection.

## Security and Threat Intelligence Value
- Detects shared-address clusters (potential shell networks).
- Highlights low-confidence records for analyst review.
- Supports expansion to director/phone/device-level fraud signals.

## Tech Stack
- Backend API: Node.js + Express
- Data Processing: Python + Pandas + RapidFuzz
- Databases: PostgreSQL + Neo4j
- Frontend: React + Vite
- Runtime: Docker Compose

## Current Implementation Status
- MVP pipeline is implemented end-to-end.
- Docker services, ETL, resolution outputs, API, and frontend are operational.
- Project tracker baseline is marked complete.

## Roadmap (Post-MVP)
1. Add RBAC and audit logs.
2. Add upload-driven live ingestion from UI.
3. Improve graph interactivity and drill-down investigation workflows.
4. Cloud deploy (frontend + API + managed graph DB).

## Expected Impact
OmniGraph converts fragmented business records into a practical, non-invasive intelligence layer for compliance, risk monitoring, and anti-fraud operations.
