# Mercury Call Desk — Protected Admin Read Report Boundary

A first cluster of protected Admin read-only JSON reports uses the shared authenticated response contract in `src/lib/authenticated-json-boundary.ts`.

## Covered reports

- `/api/admin/leads/deployment-verification`
- `/api/admin/project-readiness`
- `/api/admin/servicing/acceptance-readiness`
- `/api/admin/leads/controlled-test-data`

## Response contract

Each route:

- is force-dynamic;
- requires an Admin role;
- returns `Cache-Control: no-store, max-age=0`;
- returns a bounded caller-supplied or generated `X-Request-Id`;
- returns `X-Robots-Tag: noindex, nofollow, noarchive`;
- uses the shared `authenticatedJson` response helper;
- does not parse a request body.

The viewer metadata contains the current role only. Internal User IDs and email addresses are not returned.

## Read-failure behavior

The Servicing acceptance-readiness route preserves its source snapshot's success/failure contract:

- HTTP 200 when the snapshot succeeds;
- HTTP 503 when the snapshot reports a read failure.

The remaining report routes preserve their existing HTTP 200 success behavior after Admin authorization.

## Controlled-test-data report

The controlled-test-data report retains its existing query, count, safety, and synthetic Lead fields. It continues to:

- select only Leads matched by `controlledTestLeadWhere`;
- return at most 100 records;
- report active/archived and audit counts;
- identify synthetic contact data and blocked GHL export behavior;
- perform no write or external call.

This change does not alter the report's existing protected Admin detail level. It only standardizes response metadata.

## Unchanged behavior

The deployment verification, project readiness, Servicing readiness, and controlled-test-data snapshot/query helpers are unchanged. The routes do not create, update, delete, resolve, replay, preview, apply, export, or activate anything.

## Regression check

`npm run check:admin-read-report-boundary` protects:

- Admin authorization and force-dynamic behavior;
- use of the shared request-ID/no-store/noindex response helper;
- role-only viewer metadata;
- HTTP 503 on Servicing snapshot read failure;
- the controlled-test query/safety/report contract;
- absence of body parsing and mutation primitives;
- documentation/build/deployment wiring.

The guard is source-only. It does not query production during validation, return controlled test records, or mutate any record.

## Safety boundary

No protected report endpoint was authenticated or queried while implementing or validating this work. No Lead, controlled test record, AuditLog, Client Account, Service Case, IntegrationError, WebhookEvent, feature flag, migration, external workflow, payment, or payout was mutated.
