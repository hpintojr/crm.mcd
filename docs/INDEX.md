# Mercury Call Desk — Documentation Index

## Start Here

1. [README](../README.md)
2. [CLAUDE.md](../CLAUDE.md)
3. [Daily Log](./DAILY_LOG.md)
4. [Rebuild V1 Specification](./REBUILD_V1_SPEC.md)
5. [Rebuild Preview Environment](./REBUILD_V1_PREVIEW_ENVIRONMENT.md)
6. [Rebuild Codebase Audit](./CODEBASE_AUDIT.md)
7. [Database Schema Inventory](./DATABASE_SCHEMA_INVENTORY.md)
8. [2026-07-03 Rebuild Audit Log](./REBUILD_AUDIT_LOG_2026-07-03.md)

## Historical Feature-Gated References

- [Lead MVP Rollout Status](./LEAD_MVP_ROLLOUT_STATUS.md)
- [Lead MVP Acceptance Test](./LEAD_MVP_ACCEPTANCE_TEST.md)
- [Client Servicing Health Status](./CLIENT_SERVICING_HEALTH_STATUS.md)
- [Client Servicing Health Acceptance Test](./CLIENT_SERVICING_HEALTH_ACCEPTANCE_TEST.md)

## Current State

- Recovery: `recovery/e59-route-fix` at `92c052a`.
- Workspace: `rebuild/m1-role-shell`.
- Audit branch: `docs/rebuild-audit-2026-07-03`.
- Preview database: `preview-rebuild-v1`.
- Production is frozen.
- Current gate: Client Servicing Health SQL exists, but its models are absent from `prisma/schema.prisma`.

## Maintenance

Update `README.md`, `CLAUDE.md`, `docs/DAILY_LOG.md`, this index, and `docs/DATABASE_SCHEMA_INVENTORY.md` whenever scope, environment, acceptance status, schema baseline, or release rules change.
