# OmniGraph Pending and Next Steps

## What Is Already Complete
- End-to-end ingestion, normalization, entity resolution, and processed outputs.
- Neo4j load and risk query scripts.
- Express API and React dashboard.
- Docker Compose orchestration and automation scripts.

## Pending (High Priority for Demo Quality)
1. Stronger graph visualization UX
- Add zoom, filter, and node type legend.
- Highlight high-risk clusters in color.

2. Tier-3 LLM demo case
- Add 2-3 intentionally ambiguous records that bypass Tier-1/Tier-2.
- Demonstrate successful Tier-3 fallback behavior.

3. Demo hardening
- Add a compact runbook for recovery if one service fails.
- Add API smoke tests and seed reload command.

## Pending (High Priority for Production-readiness)
1. Authentication and RBAC
- Role-scoped access for department users.
- Audit trail for sensitive graph lookups.

2. Data governance
- PII masking strategy by role.
- Data retention and provenance annotations.

3. Deployment
- Host frontend and API in cloud.
- Use managed graph/relational DBs.
- Add environment-based secrets management.

## Suggested Immediate Action Plan
1. Finalize demo dataset with one guaranteed anomaly cluster.
2. Add graph UI controls and hover details.
3. Add one-click smoke test script:
- service health
- API endpoint checks
- query return sanity checks
4. Prepare pitch deck using `docs/demo_flow.md` and `docs/architecture.md`.
