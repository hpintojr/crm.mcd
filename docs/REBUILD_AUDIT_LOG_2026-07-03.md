# 2026-07-03 Rebuild Audit Log

Branch: `docs/rebuild-audit-2026-07-03`.

- Source reviewed: `rebuild/m1-role-shell`.
- Preview database reviewed: `preview-rebuild-v1`.
- Production was not changed.
- Admin and Portal role checks were reviewed.
- Lead behavior remains feature-gated.
- Database drift was found: `ClientAccount`, `ClientServiceActivity`, `ClientServiceAssignmentEvent`, and `ClientServiceCase` are in Preview but not in the active Prisma schema.
- Do not begin servicing, commissions, House-transfer, or migration work until the schema is reconciled.
- Required acceptance test: Agent MFA to `/portal`, with direct `/admin` access denied.

See `CODEBASE_AUDIT.md` and `DATABASE_SCHEMA_INVENTORY.md`.
