# Mercury Call Desk — Portal Write Request Boundary

Authenticated portal write routes use one shared request and response boundary in `src/lib/portal-request-boundary.ts`.

## Covered routes

- `POST /api/portal/actions`
- `POST /api/portal/dnc`
- `POST /api/portal/leads/call-start`
- `POST /api/portal/release`
- `POST /api/auth/logout-audit` response metadata

## Authentication before body reads

Lead write routes complete their existing role check before reading or parsing JSON. This prevents unauthenticated callers from forcing body parsing and preserves the existing Agent/Admin authorization rules.

The call-start service still performs its existing controlled-test and Agent-certification checks. The added route-level role check is an outer request boundary, not a replacement for business authorization.

## Bounded JSON intake

Portal write JSON is limited to 16 KiB using both:

- declared `Content-Length`, when present;
- actual UTF-8 byte length after the body is read.

Oversized requests return HTTP 413. Unreadable or malformed JSON returns a generic HTTP 400 response. Route-specific Zod schemas continue to validate Lead IDs, actions, notes, reasons, dispositions, and callback dates.

## Response contract

Every covered response includes:

- `Cache-Control: no-store, max-age=0`;
- a bounded caller-supplied or generated `X-Request-Id`;
- `X-Robots-Tag: noindex, nofollow, noarchive`.

The logout-audit compatibility endpoint remains side-effect free. NextAuth's `signOut` event remains the source of the `LOGOUT` AuditLog record.

## Error disclosure

The call-start route maps only known eligibility and stale-Lead outcomes to approved public messages. Unexpected exceptions are rethrown so they remain visible in runtime telemetry instead of being returned to the browser.

Other portal write routes retain their existing validation and business-rule messages. Unexpected database failures continue to propagate through the framework error boundary.

## Unchanged behavior

This boundary does not change:

- Lead feature gates;
- Agent/Admin roles;
- ownership checks;
- controlled-test restrictions;
- Lead lifecycle, pool, DNC, suppression, callback, disposition, or release rules;
- transactions, AuditLog records, LeadActivity records, or claim events;
- the 45-day release timer;
- NextAuth logout auditing.

## Regression check

`npm run check:portal-write-request-boundary` protects:

- the 16 KiB declared and actual body limits;
- no-store/noindex/request-ID response metadata;
- authentication ordering before body parsing;
- shared-boundary adoption across all four Lead write routes;
- the side-effect-free logout compatibility route;
- absence of route-level `request.json()`, `NextResponse.json`, and raw `error.message` disclosure;
- rethrowing unexpected call-start failures.

The guard is source-only. It does not submit a portal action, change a Lead, create a callback, add a note, suppress a contact, release ownership, or trigger logout.

## Safety boundary

No production portal POST route was invoked while implementing or validating this work. No Lead, Agent, User, callback, activity, suppression, AuditLog, feature flag, migration, GHL workflow, payment, or payout was read or mutated.
