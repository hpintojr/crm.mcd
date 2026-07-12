# Mercury Call Desk MiniCRM — Documentation Index

## Start here

1. [Project README](../README.md) — platform overview, guardrails, and controlled next steps.
2. [Workspace](./WORKSPACE.md) — current implementation inventory, feature gates, test plan, and operational page map.
3. [Working Instructions](../CLAUDE.md) — coding and operational constraints for future implementation sessions.

## Rollout and acceptance

- [Lead MVP Rollout Status](./LEAD_MVP_ROLLOUT_STATUS.md)
- [Lead MVP Acceptance Test](./LEAD_MVP_ACCEPTANCE_TEST.md)
- [Production Smoke](./PRODUCTION_SMOKE.md) — automated deployed-SHA, status, login, and protected-boundary verification.
- [Lead Aging Cron](./LEAD_AGING_CRON.md) — secured schedule, bounded database readiness retries, failure contracts, and unchanged aging rules.
- [Daily Log](./DAILY_LOG.md)

## Current operational reference

- Project Readiness: `/admin/project-readiness`
- Servicing Acceptance Preflight: `/admin/servicing/acceptance-command-center`
- Lead Aging Cron: `/api/cron/leads/aging`
- Admin Lead Review: `/admin/leads`
- Lead acceptance evidence: `/admin/leads/testing`
- Warm Reply Triage: `/admin/leads/replies`
- Integration Monitor: `/admin/integrations`
- Resolved Integration History: `/admin/integrations/resolved`
- Agent Operations: `/admin/agents`
- Client Onboarding Queue: `/admin/servicing/onboarding`
- Client Servicing: `/admin/servicing`
- Readiness Board: `/admin/readiness`
- Audit History: `/admin/audit`

## Documentation maintenance rule

When a workflow or safety boundary changes, update the README, Workspace, relevant rollout/acceptance file, daily log, and this index in the same documentation pass. Do not mark a workflow live merely because code exists; include its gate state and controlled-test status.
