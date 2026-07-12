# Mercury Call Desk — Inbound GHL Webhook Request Boundary

All six inbound GHL webhook routes use one shared request boundary in `src/lib/ghl-webhook.ts`.

## Authenticate before reading the body

The `x-mcd-webhook-secret` header is checked with constant-time comparison before `request.text()` is called. An invalid or missing secret returns HTTP 401 without reading or parsing the request body.

This prevents unauthenticated callers from forcing JSON parsing or downstream schema work.

## Bounded JSON intake

Authorized requests are limited to 1 MiB using both:

- the declared `Content-Length` when present;
- the actual UTF-8 byte length after reading.

Oversized requests return HTTP 413. Unreadable or malformed JSON returns generic HTTP 400 responses. Payload-specific Zod validation remains in each route and continues to return HTTP 422 for schema failures.

## Location verification

The body must be parsed and validated before its GHL location ID is available. Each route therefore performs approved-location verification immediately after its existing payload schema succeeds and before recording or processing the event.

The existing HTTP 202 response for an unapproved location is preserved.

## Response contract

Every shared-boundary response includes:

- `Cache-Control: no-store, max-age=0`;
- `X-Request-Id` using a bounded caller-supplied identifier or a generated UUID;
- `X-Robots-Tag: noindex, nofollow, noarchive`.

Success, duplicate, ignored, queued, unmatched, conflict, provisioning, and attribution response bodies retain their existing business fields.

## Sanitized failure evidence

Webhook processing failures no longer return raw exception messages or store them as the primary IntegrationError message.

The shared boundary records only:

- route/source name;
- request ID;
- opaque event/reference ID;
- sanitized error class name;
- recognized database/network error code when available.

The public caller receives the route’s generic processing-failure message. Raw payloads remain durably stored only in the existing `WebhookEvent` replay ledger for accepted, approved-location events.

## Covered routes

- appointments;
- documents;
- funding;
- invoices;
- opportunities;
- inbound replies.

## Unchanged behavior

This hardening does not change webhook secrets, approved-location configuration, route payload schemas, unique event IDs, the atomic replay claim, event status transitions, appointment attribution, opportunity attribution, inbound-reply gating, onboarding document gates, Agent provisioning, activation-link issuance, or downstream business responses.

## Regression check

`npm run check:ghl-webhook-request-boundary` protects:

- secret verification before body reads;
- declared and actual 1 MiB limits;
- centralized no-store/noindex/request-ID responses;
- post-schema location verification;
- use of the shared boundary by all six routes;
- absence of route-level `request.json()`, `NextResponse.json`, legacy combined verification, and raw exception-message persistence.

The guard performs source validation only. It does not send a webhook, call GHL, read production webhook records, or mutate production data.

## Safety boundary

No inbound webhook endpoint was invoked while implementing or validating this work. No external API, Lead, Agent, User, Appointment, onboarding document, callback, audit record, integration record, feature flag, migration, payment, or payout was changed in production.
