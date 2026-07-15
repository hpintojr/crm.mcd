# Service Cadence Cron

**Status:** Built and scheduled; fully inert in production because `/api/cron/servicing/cadence` returns 404 while `SERVICING_ENABLED=false`. The staged `SERVICE_CADENCE` enum migration must be applied (with explicit owner authorization) before the Servicing gate opens.

## What it does

Daily at 12:30 UTC (30 minutes after the Lead aging sweep), Vercel Cron calls `/api/cron/servicing/cadence` with the `CRON_SECRET` bearer token. The sweep (`src/lib/service-cadence-jobs.ts`):

1. Reads all `ACTIVE` client accounts.
2. Computes each account's required cadence from `requiredCadence` in `src/lib/service-rules.ts` — the roadmap-aligned rules (Starter biweekly→monthly, Growth weekly→biweekly, Pro/Enterprise weekly with the 60-minute guarantee). Days-since-activation is anchored on `launchCompletedAt` (falling back to `createdAt`).
3. Determines the next due date from the latest of: launch completion, last `HEALTH_CONFIRMATION` service activity, or the last cadence case opening (`src/lib/service-cadence-schedule.ts`, pure and guard-tested).
4. When the cadence period has elapsed and the account has **no open cadence case**, opens a `SERVICE_CADENCE` Service Case (priority `NORMAL`, assigned to the account owner, `dueAt` = the computed due date) and writes a `SERVICE_CADENCE_CASE_OPENED` audit entry with `actorRole: SYSTEM`.

The open-case dedupe makes the daily sweep idempotent: an account is never given a second cadence case while one is open, and resolving a case restarts the clock from its opening.

## Operational contract

- Same resilience shape as the Lead aging cron: `CRON_SECRET` auth, transient-database readiness probe with bounded retries, the mutating sweep runs exactly once, request-correlated sanitized `503`/`500` failures.
- `?dryRun=1` previews without writing; `?limit=` caps case creation per run (default 100, max 500).
- The sweep's read path compares `trigger` as text, so reads are safe even before the enum migration is applied; only the mutation path requires the `SERVICE_CADENCE` label.
- `GROWTH` accounts after 90 days default to `BIWEEKLY`; a per-account monthly preference is not stored today (out of scope — worth a follow-up if the business wants it).

## Superseded module

`src/lib/service-cadence.ts` (an earlier, unused draft with thresholds that conflicted with the roadmap rules) was deleted; `src/lib/service-rules.ts` is the single source of cadence truth. The guard `scripts/check-service-cadence-cron.ts` keeps it deleted and verifies the schedule math, route gating, and cron wiring.

## Before the Servicing acceptance window

1. Rehearse `prisma/migrations/20260715120000_add_service_cadence_trigger` on a disposable Neon branch.
2. Obtain explicit owner authorization and apply it to production.
3. Include a `dryRun` cadence sweep in the acceptance checklist before relying on scheduled runs.
