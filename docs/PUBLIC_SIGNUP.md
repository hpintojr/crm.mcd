# Mercury Call Desk — Public Partner Signup

The public partner application surface is `/signup`, backed by `POST /api/signup`.

## Accepted information

The endpoint accepts only onboarding contact information validated by `signupSchema`:

- legal and preferred names;
- optional company name;
- personal email;
- mobile number;
- optional mailing address and emergency contact;
- contact and e-sign consent.

Social Security numbers, tax IDs, bank details, passwords, credentials, and payment information are never accepted by this endpoint.

## Request boundary

- Requests are limited to 16 KiB using both the declared content length and the actual UTF-8 body length.
- Invalid JSON returns a generic HTTP 400 JSON response.
- Validation failures return field messages but never echo submitted values.
- Email is trimmed and canonicalized to lowercase before persistence.
- All responses use `Cache-Control: no-store`, an `X-Request-Id`, and `X-Robots-Tag: noindex, nofollow, noarchive`.
- The honeypot field returns the same minimal success shape without performing a database or GHL action.

## Durable reservation before GHL

A valid application is reserved locally before any external integration call:

1. One transaction creates the `Agent`, the four pending onboarding-document rows, and an initial `AGENT_SIGNUP` AuditLog with GHL state `pending`.
2. The unique normalized email reserves the application against concurrent or retried submissions.
3. A Prisma unique conflict is treated as idempotent success and does not reveal whether an email already exists.
4. Only the request that created the durable reservation calls the GHL contact upsert.
5. A second transaction records the GHL result and contact ID, or creates a sanitized `IntegrationError` for later review.

The external GHL call is never placed inside a database transaction.

## Public response

Successful, honeypot, duplicate, and concurrent-retry outcomes return only:

```json
{ "ok": true }
```

The public response does not expose the internal Agent ID, GHL contact ID, GHL configuration state, stub state, raw integration errors, database details, or whether a submitted email already existed.

## Failure and observability behavior

- A failure before the durable reservation returns generic JSON and does not call GHL.
- Once the Agent and initial AuditLog are durable, a later integration-finalization persistence failure is logged with only request ID, opaque Agent ID, sanitized error name, and database error code. The public request remains accepted so the applicant is not encouraged to create a duplicate retry.
- A GHL failure records a sanitized internal `IntegrationError` with operation name and request ID. Raw GHL response bodies and exception messages are not stored in signup audit metadata or returned publicly.

## Regression check

`npm run check:public-signup-boundary` tests input normalization and duplicate classification, verifies reservation-before-GHL ordering, protects the minimal response, and rejects reintroduction of preflight email lookup or raw GHL error storage.

The guard is part of the authoritative build and deployment-verification chain. It does not submit a signup, access production data, or call GHL.

## Safety boundary

This workflow does not change who is eligible to apply, the `SUBMITTED` starting status, required onboarding documents, contact/e-sign consent, or the one-way GHL handoff. No signup endpoint was invoked while implementing or validating this hardening.
