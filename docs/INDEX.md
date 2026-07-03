# Mercury Call Desk — Documentation Index

## Start Here for a Handoff

1. [README](../README.md) — purpose, stack, release posture, and rebuild status.
2. [CLAUDE.md](../CLAUDE.md) — required implementation rules.
3. [Daily Log](./DAILY_LOG.md) — dated facts, test results, and next acceptance actions.
4. [Rebuild V1 Specification](./REBUILD_V1_SPEC.md) — product scope, roles, workflows, milestones, and acceptance gates.
5. [Rebuild Preview Environment](./REBUILD_V1_PREVIEW_ENVIRONMENT.md) — Preview isolation and service guardrails.
6. [Rebuild Codebase Audit](./CODEBASE_AUDIT.md) — verified source baseline and rebuild findings.
7. [Database Schema Inventory](./DATABASE_SCHEMA_INVENTORY.md) — Preview database inventory and reconciliation gate.

## Current Technical State

- Recovery baseline: `recovery/e59-route-fix` at `92c052a`.
- Active implementation branch: `rebuild/m1-role-shell`.
- Documentation audit branch: `docs/rebuild-audit-2026-07-03`.
- Preview database: `preview-rebuild-v1` (`br-twilight-snow-aj4widc4`).
- Production is frozen pending explicit acceptance.
- Current blocker: four client-servicing tables exist in Preview but are absent from `prisma/schema.prisma`.

## Existing Operational Documents

- [Lead MVP Rollout Status](./LEAD_MVP_ROLLOUT_STATUS.md)
- [Lead MVP Acceptance Test](./LEAD_MVP_ACCEPTANCE_TEST.md)

These Lead MVP documents are historical references during the rebuild. They do not authorize turning on lead workflows or changing production.

## Documentation Maintenance Rule

Any branch that changes product scope, release status, environments, access controls, data behavior, integrations, acceptance criteria, or schema alignment must update:

- `README.md`
- `docs/DAILY_LOG.md`
- this index when navigation changes
- `CLAUDE.md` when operating rules change
- `docs/DATABASE_SCHEMA_INVENTORY.md` when the approved schema baseline changes
