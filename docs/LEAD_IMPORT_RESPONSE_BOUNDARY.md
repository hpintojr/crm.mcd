# Mercury Call Desk — Signed Lead Import Response Boundary

The signed `/api/lead-imports/*` lifecycle uses one shared request and response boundary in `src/lib/lead-import-route-guard.ts`.

## Covered routes

- `POST /api/lead-imports`
- `GET /api/lead-imports/[batchId]`
- `POST /api/lead-imports/[batchId]/owner-acquisition`
- `POST /api/lead-imports/[batchId]/rows`
- `POST /api/lead-imports/[batchId]/preview`
- `POST /api/lead-imports/[batchId]/submit`

## Request contract

The shared guard:

- derives a bounded request ID from `x-mcd-import-request-id` or generates a UUID;
- rejects declared bodies above 1,000,000 bytes;
- resolves the configured HMAC key before consuming the request body;
- returns a controlled 400 when the body cannot be read;
- rejects actual UTF-8 bodies above 1,000,000 bytes;
- verifies content type, timestamp, body digest, HMAC signature, and configured key ID before JSON parsing;
- parses JSON only after transport verification succeeds;
- touches no database before the signed request guard succeeds.

## Response contract

Every covered route response uses `leadImportJson` and returns:

- `Cache-Control: no-store, max-age=0`;
- `X-Request-Id` using the sanitized caller request ID or generated UUID;
- `X-Robots-Tag: noindex, nofollow, noarchive`;
- the route's existing JSON body and HTTP status.

Typed batch-not-found, invalid-state, and replay-conflict failures are mapped by `leadImportDomainErrorResponse`. The mapper preserves their existing messages/statuses and returns `null` for unknown failures, which remain generic route-level `LEAD_IMPORT_INTERNAL_ERROR` responses.

The response helpers do not change batch serialization, validation issues, replay-conflict results, state errors, concurrency recovery, preview behavior, submit behavior, provenance rules, or audit evidence.

## Regression coverage

`npm run check:lead-import-response-contract` protects:

- response-schema compatibility;
- helper adoption across all six lifecycle routes;
- absence of direct route-level body reads and direct `NextResponse` construction;
- generic internal-error responses;
- request-ID, no-store, and noindex headers;
- configuration-before-body ordering;
- bounded body reads;
- signature verification before JSON parsing.

`npm run check:signed-import-domain-errors` additionally protects the exact three typed domain classes, error codes/statuses, route adoption, generic unknown failures, and the Route Boundary Registry reduction.

The checks are source-only. They do not call an import endpoint, create a batch, upload rows, run a preview, submit a batch, query production, or write audit evidence.

## Safety boundary

This hardening does not alter import eligibility, suppression, deduplication, taxonomy, provenance, immutable replay, concurrency recovery, Lead creation, audit outcomes, feature flags, GHL workflows, Servicing, Commission, Finance, payments, or payouts.
