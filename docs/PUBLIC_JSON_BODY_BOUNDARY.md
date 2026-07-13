# Mercury Call Desk — Public JSON Body Boundary

`preparePublicJsonBody` in `src/lib/public-json-body-boundary.ts` centralizes the bounded raw-body intake used by public account activation and public partner signup.

## Ordered body handling

The helper preserves the exact pre-parse sequence:

1. Inspect the declared `Content-Length` and reject it when it exceeds the route-provided byte limit.
2. Read the request body as raw text.
3. Measure the actual UTF-8 byte length and reject it when it exceeds the same limit.
4. Parse JSON only after both size checks pass.

This ordering prevents JSON parsing from occurring before actual byte limits are enforced.

## Route-specific limits

- Account activation supplies `MAX_ACTIVATION_BODY_BYTES` (`8,192` bytes).
- Public partner signup supplies `MAX_PUBLIC_SIGNUP_BODY_BYTES` (`16,384` bytes).

The helper does not own or change those values.

## Exact failure contracts

Both routes already shared these public failures, which remain unchanged:

- declared or actual body too large: HTTP 413 with `{ "error": "Request too large." }`;
- body read failure: HTTP 400 with `{ "error": "Unable to read request." }`;
- invalid JSON: HTTP 400 with `{ "error": "Invalid JSON" }`.

Every failure uses the existing shared route JSON response boundary with the route's request ID, `Cache-Control: no-store, max-age=0`, and `X-Robots-Tag: noindex, nofollow, noarchive`.

## Separation from schema and business behavior

The helper returns parsed `unknown` data only. It does not:

- run Zod schemas;
- inspect activation tokens, passwords, TOTP values, signup identity fields, or contact information;
- access the database;
- create or update records;
- call GHL;
- write AuditLog or IntegrationError evidence;
- decide any business outcome.

Activation still applies `activationRequestSchema` after the helper. Signup still applies `signupSchema` after the helper.

## Zero-finding Route Boundary Registry

Moving `request.text()` out of the two route files removes the final reviewed route-level primitives. The source-derived Route Boundary Registry now contains zero reviewed findings and zero frozen debt.

The scanner remains fail-closed. Any future direct route parser, direct response constructor, or route-level raw error message will fail CI until explicitly reviewed.

## Regression coverage

`npm run check:public-json-body-boundary` protects:

- the exact declared/read/actual/parse ordering;
- exact 413 and 400 response bodies;
- request-ID, no-store, and noindex response metadata;
- route-specific byte-limit constants;
- schema parsing after the helper;
- absence of direct body parsing in activation and signup routes;
- the zero-finding registry baseline;
- documentation, build, and deployment-verification wiring.

The dedicated activation and signup guards continue protecting all downstream business behavior.

## Safety boundary

This change and its checks are source-only. It does not invoke either endpoint, query or mutate production data, call GHL, trigger cron or webhooks, run imports or exports, change feature flags, apply migrations, activate Servicing or Commissions, store financial-account data, release payouts, or move money.
