# Mercury Call Desk — Lead Acceptance Report Response Boundary

The non-download Lead acceptance JSON reports use the shared authenticated response contract in `src/lib/authenticated-json-boundary.ts`.

## Covered JSON reports

- `/api/admin/leads/acceptance-findings`
- `/api/admin/leads/acceptance-gaps`
- `/api/admin/leads/acceptance-gates`
- `/api/admin/leads/acceptance-handoff`
- `/api/admin/leads/acceptance-matrix`
- `/api/admin/leads/acceptance-overview`
- `/api/admin/leads/acceptance-report`
- `/api/admin/leads/deep-links`
- `/api/admin/leads/aging-preview`

## Response contract

Each report:

- is force-dynamic;
- requires an Admin role;
- returns `Cache-Control: no-store, max-age=0`;
- returns a bounded caller-supplied or generated `X-Request-Id`;
- returns `X-Robots-Tag: noindex, nofollow, noarchive`;
- uses the shared `authenticatedJson` helper;
- does not parse a request body;
- does not return an internal viewer User ID or email address.

Catalog-style reports return viewer role only. The acceptance report and aging preview retain their existing `generatedByRole` field.

## Report behavior preserved

The following helpers and calculations remain unchanged:

- findings catalog and counts;
- acceptance evidence gaps;
- closed acceptance gates;
- handoff packet;
- evidence matrix;
- acceptance overview;
- deep-link catalog;
- acceptance AuditLog query and latest-per-step calculations;
- acceptance group and outcome counts;
- controlled evidence summary;
- dry-run aging sweep and optional limit query parameter.

The aging preview continues to call `runLeadAgingSweep` with `dryRun: true` and reports `mutationPerformed: false`.

## CSV and download separation

The JSON response helper is not applied to:

- `/api/admin/leads/acceptance-history.csv`
- `/api/admin/leads/acceptance-report.csv`

Those routes retain their `text/csv` content type and `Content-Disposition` download contracts. CSV/download behavior is guarded separately from JSON report behavior.

## Regression check

`npm run check:lead-acceptance-report-boundary` protects:

- Admin authorization, force-dynamic behavior, and shared response metadata;
- role-only viewer metadata;
- absence of body parsing and mutation primitives;
- every existing report helper/calculation entry point;
- the AuditLog query bound of 1,000 acceptance records;
- the dry-run aging contract;
- CSV content-type and attachment separation;
- documentation/build/deployment wiring.

The guard is source-only. It does not query production during validation, read acceptance evidence, execute the aging preview, download a CSV, or mutate any record.

## Safety boundary

No protected report endpoint was authenticated or queried while implementing or validating this work. No acceptance record, Lead, callback, AuditLog, feature flag, GHL workflow, Servicing record, Commission record, payment, or payout was mutated.
