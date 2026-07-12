# Mercury Call Desk — Legacy Admin Lead Import Retirement

`POST /api/admin/leads` is retired and returns an authenticated HTTP 410 response.

## Why the route was retired

The route predated the current import lifecycle and independently:

- parsed an unbounded JSON body;
- previewed and committed through one endpoint;
- created Leads row by row outside the current batch/replay workflow;
- performed read-then-create duplicate checks;
- could leave a partially committed batch if a later row failed;
- returned newly created Lead IDs;
- bypassed the newer preview, immutable batch, concurrency, replay, provenance, and response-contract guards.

Repository search found no current caller for the legacy endpoint. The Admin import UI already uses the supported endpoints.

## Supported replacement

The controlled Admin import UI uses:

- preview: `POST /api/admin/leads/import/preview`;
- commit: `POST /api/admin/leads/import`.

Those routes retain the current taxonomy, source/provenance, suppression, deduplication, preview-before-commit, immutable replay, concurrency recovery, audit, and response-contract checks.

## Retired response contract

After the Lead feature gate and Admin role check, the legacy endpoint returns HTTP 410 with:

- a generic retirement message;
- the supported preview and commit paths;
- `Cache-Control: no-store, max-age=0`;
- a bounded caller-supplied or generated `X-Request-Id`;
- `X-Robots-Tag: noindex, nofollow, noarchive`.

The route does not read or parse the request body and performs no database operation.

## Regression check

`npm run check:legacy-admin-lead-import-retirement` protects:

- Admin authentication before replacement-path disclosure;
- the HTTP 410 response;
- the supported preview and commit route references;
- absence of body parsing, database access, preview/import services, Lead creation, suppression checks, audits, activity writes, and created-ID responses;
- continued use of the supported import lifecycle by `AdminLeadImportForm`.

The guard is source-only. It does not call the retired endpoint, preview an import, commit a batch, or read or mutate any Lead data.

## Safety boundary

No import endpoint was invoked while implementing or validating this retirement. No production Lead, suppression record, import batch, audit record, activity, feature flag, migration, external workflow, payment, or payout was read or mutated.
