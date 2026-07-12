# Mercury Call Desk — Lead Aging Cron

The secured Lead aging route is `/api/cron/leads/aging`. It performs the existing 45-day claimed-Lead return and 21-day Open Pool → Shark Tank promotion rules.

## Security boundary

- `LEADS_ENABLED` must be on.
- The request must send `Authorization: Bearer <CRON_SECRET>`.
- Responses use `Cache-Control: no-store` and include an `X-Request-Id`.
- The route never returns raw database error text, database hosts, credentials, or connection strings.

## Database readiness behavior

Before selecting any Leads, the route runs a read-only `SELECT 1` readiness probe.

- The readiness probe may retry up to five times for recognized transient database connectivity failures.
- Delay is bounded exponential backoff: 1, 2, 4, and 8 seconds between attempts.
- The App Router function has an explicit 90-second maximum duration so the expanded readiness window remains bounded.
- A failed readiness probe returns HTTP `503`, `retryable: true`, `phase: database-readiness`, and `Retry-After: 60`.

The expanded readiness window was added after the July 12, 2026 scheduled run exhausted the former three-attempt, sub-second backoff while the Neon pooler remained temporarily unavailable. The change gives the read-only probe more time to observe recovery within the same scheduled invocation.

The actual Lead aging sweep is **never retried** by the route. It runs exactly once after a successful readiness probe. This prevents duplicate activity or audit records if a connection fails after a transaction outcome becomes uncertain.

A transient database failure during the sweep also returns HTTP `503`, but the caller or scheduler must initiate a later independent run. A non-transient application failure returns HTTP `500`.

## Existing business rules remain unchanged

The resilience wrapper does not change:

- eligible lifecycle states;
- DNC, suppression, referral, or pool exclusions;
- the 45-day claim timer;
- the 21-day Open Pool stall threshold;
- batch limits;
- dry-run behavior;
- Lead, claim-event, activity, or audit mutations.

## Dry run

An authorized operator can append `?dryRun=true` to produce the existing preview result without performing Lead mutations. Do not invoke the production cron manually unless the specific run is authorized.

## Observability

Retry and failure logs use structured fields:

- request ID;
- failure phase;
- retryability;
- database-probe attempt count;
- sanitized error name and Prisma/network error code when available.

Use the response `X-Request-Id` to correlate a failed scheduler request with Vercel runtime logs.

## Regression check

`npm run check:lead-aging-cron-resilience` verifies transient classification, the five-attempt bound, final-attempt recovery, non-transient fail-fast behavior, exhaustion behavior, the 90-second route budget, response contracts, and that the mutating sweep is awaited exactly once and is not wrapped by the retry helper.
