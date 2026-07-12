# Mercury Call Desk — Admin Controlled Test Request Boundary

`POST /api/admin/integrations/test-events` uses the shared authenticated JSON boundary in `src/lib/authenticated-json-boundary.ts`.

## Admin authorization before body reads

The route verifies the Lead feature gate and requires an Admin role before reading or parsing the request body. The controlled-test service continues to enforce that the target is an explicitly marked controlled test Lead.

This request boundary does not broaden Admin permissions over real production Leads.

## Bounded JSON intake

The request body is limited to 16 KiB using both:

- declared `Content-Length`, when present;
- actual UTF-8 byte length after reading.

Oversized requests return HTTP 413. Unreadable or malformed JSON returns generic HTTP 400 responses. The route's existing Zod schema continues to validate mode, Lead ID, event family, event type, and note length.

## Response contract

Every route response includes:

- `Cache-Control: no-store, max-age=0`;
- a bounded caller-supplied or generated `X-Request-Id`;
- `X-Robots-Tag: noindex, nofollow, noarchive`.

The successful report keeps its existing mode, generation timestamp, actor role, and controlled-test result fields.

## Expected-error handling

Only known controlled-test validation outcomes are translated to public responses:

- unsupported or family-mismatched event type: HTTP 422;
- missing controlled test Lead: HTTP 404;
- Lead not marked as controlled test data: HTTP 403;
- disabled Lead module: HTTP 404.

Unexpected service or database failures are rethrown to runtime telemetry rather than returned as raw exception messages.

## Preview and apply semantics

The route retains both existing modes:

- `preview` calls `previewControlledGhlTestEvent` exactly once;
- `apply` calls `applyControlledGhlTestEvent` exactly once.

The apply service continues to use the existing controlled-test Lead checks, simulated GHL identifiers, attribution functions, and AuditLog evidence. This change does not execute either mode.

## Regression check

`npm run check:admin-controlled-test-boundary` protects:

- Admin authorization before body reads;
- the shared 16 KiB declared and actual body limits;
- centralized no-store/noindex/request-ID responses;
- route-specific schema validation;
- exact expected-error mapping;
- absence of route-level `request.json()`, `NextResponse.json`, raw `error.message`, and console logging;
- one explicit preview call and one explicit apply call;
- rethrowing unexpected errors.

The guard is source-only. It does not call the endpoint, preview a production record, apply a controlled event, create simulated identifiers, run attribution, or write audit evidence.

## Safety boundary

No Admin controlled-test endpoint was invoked while implementing or validating this work. No Lead, Appointment, Opportunity, callback, WebhookEvent, AuditLog, IntegrationError, feature flag, migration, GHL workflow, payment, or payout was read or mutated.
