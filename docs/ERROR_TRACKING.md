# Structured Error Tracking (Sentry, server-only)

**Status:** Implemented; disabled until `SENTRY_DSN` is configured in the server environment (Vercel). With no DSN the application behaves exactly as before.

## Design

- `instrumentation.ts` initializes `@sentry/nextjs` in the Node.js runtime only, gated on `SENTRY_DSN`. `onRequestError` forwards uncaught server request errors.
- No client-side instrumentation, no `NEXT_PUBLIC_` values, no tracing (`tracesSampleRate: 0`), no default PII (`sendDefaultPii: false`). Guarded by `scripts/check-error-tracking-boundary.ts` (CI: Error Tracking Boundary workflow, `npm run check:error-tracking-boundary`).
- `src/lib/error-tracking.ts` exposes `captureIntegrationError(source, message, refId)`. `logIntegrationError` in `src/lib/ghl-webhook.ts` forwards **source, message, and reference id only** — webhook bodies, stored JSON, and PII never leave the `IntegrationError` table.
- Failures inside the tracker are swallowed; error tracking never breaks a request path.

## Configuration

| Variable | Purpose | Default |
|---|---|---|
| `SENTRY_DSN` | Server-only DSN; empty disables tracking entirely | `""` |
| `SENTRY_ENVIRONMENT` | Environment tag on events | `production` |

Configure values in Vercel only. Never commit a DSN, place it in GHL, or surface it in any agent/admin view.

## What is intentionally out of scope

- Client/browser error capture and session replay.
- Performance tracing and source-map upload (would require a build-time auth token).
- Any change to the existing `IntegrationError` database logging, which remains the system of record.
