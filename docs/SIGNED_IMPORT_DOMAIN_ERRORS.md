# Mercury Call Desk — Signed Lead Import Domain Errors

Signed Lead-import routes use `leadImportDomainErrorResponse` in `src/lib/lead-import-domain-error-response.ts` for typed, expected domain failures.

## Typed domain errors only

The mapper recognizes exactly three classes:

- `LeadImportBatchNotFoundError` → HTTP 404 with `LEAD_IMPORT_BATCH_NOT_FOUND`;
- `LeadImportBatchStateError` → HTTP 409 with `LEAD_IMPORT_INVALID_STATE`;
- `LeadImportBatchReplayConflictError` → HTTP 409 with `LEAD_IMPORT_REPLAY_CONFLICT`.

The mapper preserves each typed error's existing message and returns `null` for every other value.

It does not handle:

- Zod validation issues;
- unknown runtime failures;
- database errors;
- authentication, HMAC, content-type, timestamp, digest, or request-size failures.

Those remain with their existing route or signed transport boundary. Unknown failures remain generic `LEAD_IMPORT_INTERNAL_ERROR` responses.

## Covered routes

- `POST /api/lead-imports`
- `GET /api/lead-imports/[batchId]`
- `POST /api/lead-imports/[batchId]/rows`
- `POST /api/lead-imports/[batchId]/preview`
- `POST /api/lead-imports/[batchId]/submit`

The owner-acquisition route already used fixed public messages and required no change.

## Preserved contracts

The change preserves:

- exact domain error codes, messages, and HTTP statuses;
- Zod issue responses;
- generic unexpected-failure responses;
- success status codes: 200, 201, and 202 as previously defined;
- HMAC verification and request-ID/no-store/noindex responses;
- replay protection, immutable provenance, concurrency recovery, preview/submit behavior, database writes, and AuditLog evidence.

## Route Boundary Registry reduction

Moving typed message access out of route files removes five route-level `RAW_ERROR_MESSAGE` findings representing eight message occurrences.

The reviewed Route Boundary Registry changes from:

- 11 findings across 8 routes;

to:

- 6 approved findings across 4 routes;
- zero `RAW_ERROR_MESSAGE` findings;
- zero `FROZEN_EXISTING` findings.

The registry scanner still fails when any route primitive is added, removed, or changes count without review.

## Regression check

`npm run check:signed-import-domain-errors` protects:

- the exact three recognized error classes;
- exact codes and status mappings;
- `null` for unknown failures;
- centralized mapper adoption across five routes;
- absence of route-level domain error classes and `error.message`;
- unchanged validation, service calls, success statuses, and generic failures;
- the 11-to-6 registry reduction;
- documentation, build, and deployment-verification wiring.

The check is source-only. It does not invoke any import route, create an import batch, upload rows, run preview/submit, query production, or write AuditLog evidence.

## Safety boundary

No signed import endpoint was invoked while implementing or validating this mapping. No production Lead, import batch, suppression, AuditLog, feature flag, GHL workflow, Client Account, Service Case, Commission record, payment, or payout was read or mutated.
