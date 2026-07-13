# Mercury Call Desk — Admin Lead Import Request Boundary

The supported Admin Lead-import preview and commit endpoints use a dedicated authenticated request profile in `src/lib/admin-lead-import-request-boundary.ts`.

## Covered routes

- `POST /api/admin/leads/import/preview`
- `POST /api/admin/leads/import`

The retired duplicate writer remains `POST /api/admin/leads` and returns HTTP 410.

## Authorization before body reads

Each covered route performs this order:

1. derive a bounded request ID;
2. return a generic HTTP 404 when the Leads feature is disabled;
3. require an authorized Admin role;
4. enforce declared request size;
5. read the body;
6. enforce actual UTF-8 request size;
7. parse JSON;
8. validate the `rows` envelope and row count;
9. call the existing preview or commit service.

Unauthorized callers and disabled-feature requests do not cause the request body to be consumed.

## Request limits

Admin import payloads use a **1 MiB** maximum body size. This is separate from the 16 KiB default used by ordinary portal writes.

The existing import constraints remain:

- body must be an object containing a `rows` array;
- at least one row is required;
- at most 500 rows are allowed;
- each row is validated by the existing Lead import taxonomy and preview service.

## Response contract

All covered responses use the shared authenticated JSON helper and include:

- `Cache-Control: no-store, max-age=0`;
- `X-Request-Id`;
- `X-Robots-Tag: noindex, nofollow, noarchive`.

Status behavior:

- malformed JSON: HTTP 400;
- unreadable request: HTTP 400;
- oversized request: HTTP 413;
- missing, empty, or over-limit rows: HTTP 422;
- successful preview: HTTP 200;
- successful commit: HTTP 201;
- unexpected preview/commit failure: generic HTTP 500.

Only the two existing row-count errors may be mapped from service exceptions. Unknown exception messages are not returned to the caller. Telemetry records only the operation, request ID, and exception class name.

## Business behavior preserved

This boundary does not alter:

- `previewLeadImport` normalization, validation, deduplication, or result rows;
- `commitLeadImport` authorization defense, 500-row cap, suppression checks, duplicate checks, transaction boundaries, Lead creation, LeadActivity creation, or AuditLog evidence;
- success response bodies;
- the HTTP 201 commit success contract;
- feature flags, Lead lifecycle rules, GHL behavior, Servicing, Commission, Finance, payments, or payouts.

## Regression check

`npm run check:admin-lead-import-request-boundary` protects:

- the 16 KiB generic default and 1 MiB Admin-import profile;
- feature and Admin authorization before body reads;
- request-ID/no-store/noindex response metadata;
- shared envelope and 500-row validation;
- absence of route-level `request.json()`, `request.text()`, direct `NextResponse`, and raw exception messages;
- existing preview/commit service calls and HTTP success statuses;
- documentation, build, and deployment-verification wiring.

The check is source-only. It does not invoke preview or commit, create a Lead, query production, or write AuditLog evidence.

## Safety boundary

No Admin import endpoint was invoked while implementing or validating this boundary. No production Lead, import batch, suppression, AuditLog, feature flag, GHL workflow, Client Account, Service Case, Commission record, payment, or payout was read or mutated.
