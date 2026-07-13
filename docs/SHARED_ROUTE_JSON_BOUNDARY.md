# Mercury Call Desk — Shared Route JSON Boundary

`routeJsonResponse` in `src/lib/route-json-response.ts` is the shared constructor for the remaining public and secret-authenticated JSON route responses that do not use an authenticated session boundary.

## Exact route contracts

The helper centralizes only response metadata and request-ID normalization. Each route still owns its existing payloads, status codes, authorization, validation, database behavior, and business rules.

### Public account activation

- Retains bounded raw-body reading before JSON parsing.
- Retains all existing 200, 400, 413, 422, and 500 outcomes.
- Retains `X-Request-Id`, `Cache-Control: no-store, max-age=0`, and `X-Robots-Tag: noindex, nofollow, noarchive`.
- Does not change token consumption, password hashing, TOTP preparation, transaction ordering, or audit events.

### Public partner signup

- Retains bounded raw-body reading before JSON parsing.
- Retains the privacy-preserving HTTP 202 accepted response for new, duplicate, and honeypot submissions.
- Retains validation and internal-error statuses.
- Retains `X-Request-Id`, no-store, and noindex headers.
- Does not change durable reservation ordering, GHL contact synchronization, integration-error evidence, or audit updates.

### Lead aging cron

- Retains bearer-secret authorization and all existing payloads/statuses.
- Retains `X-Request-Id` and no-store headers.
- Retains `Retry-After: 60` only for retryable failures.
- Does not add noindex where it did not previously exist.
- Does not change database readiness retries or the rule that the mutating sweep runs exactly once.

### Public deployment status

- Retains the minimal service, environment, branch, and commit-SHA payload.
- Retains HTTP 200, no-store, and noindex headers.
- Does not add request IDs or expose commit messages, deployment hostnames, regions, timestamps, or secrets.

## Request IDs

`routeRequestId` preserves a supplied `X-Request-Id` only when it is non-empty, no longer than 128 characters, and matches the existing safe character set. Otherwise it generates a UUID.

## Route Boundary Registry reduction

The shared constructor removes four direct `NextResponse.json()` route findings:

- account activation;
- public partner signup;
- Lead aging cron;
- public deployment status.

The reviewed registry changes from 6 findings across 4 routes to 2 approved findings across 2 routes. The only remaining findings are the required bounded `request.text()` reads for activation and signup.

## Regression coverage

`npm run check:shared-route-json-boundary` protects:

- exact shared no-store, request-ID, noindex, and retry-after behavior;
- route-specific option usage;
- absence of direct response construction in the four routes;
- preservation of bounded raw-body reads;
- the two-finding Route Boundary Registry baseline;
- documentation, build, and deployment-verification wiring.

Existing activation, signup, cron, and Production Smoke guards continue protecting their route-specific behavior and deployed headers.

## Safety boundary

The implementation and checks are source-only. They do not invoke signup, activation, cron, status mutation, imports, exports, controlled tests, or webhooks. They do not query or mutate production data, change feature flags, call GHL, apply migrations, activate Servicing or Commissions, store financial-account data, release payouts, or move money.
