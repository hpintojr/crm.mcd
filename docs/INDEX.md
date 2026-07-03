# Mercury Call Desk — Documentation Index

## Start Here for a Handoff

1. [README](../README.md) — project purpose, stack, release posture, and current rebuild status.
2. [CLAUDE.md](../CLAUDE.md) — required operating rules for future implementation work.
3. [Daily Log](./DAILY_LOG.md) — dated facts, current branch, current Preview, tests, and next acceptance actions.
4. [Rebuild V1 Specification](./REBUILD_V1_SPEC.md) — approved product scope, role rules, workflow rules, milestones, and acceptance gates.
5. [Rebuild Preview Environment](./REBUILD_V1_PREVIEW_ENVIRONMENT.md) — Preview database isolation and external-service guardrails.

## Current Technical State

- Working recovery baseline: `recovery/e59-route-fix` at `92c052a`.
- Active implementation branch: `rebuild/m1-role-shell`.
- Current Preview database branch: `preview-rebuild-v1` (`br-twilight-snow-aj4widc4`).
- Production is frozen pending explicit approval after Preview acceptance.

## Existing Operational Documents

- [Lead MVP Rollout Status](./LEAD_MVP_ROLLOUT_STATUS.md)
- [Lead MVP Acceptance Test](./LEAD_MVP_ACCEPTANCE_TEST.md)

These Lead MVP documents are historical references during the rebuild. They do not authorize turning on lead workflows or changing production.

## Documentation Maintenance Rule

Any branch that changes product scope, release status, environments, access controls, data behavior, integrations, or acceptance criteria must update:

- `README.md`
- `docs/DAILY_LOG.md`
- this index when document navigation changes
- `CLAUDE.md` when implementation rules change
