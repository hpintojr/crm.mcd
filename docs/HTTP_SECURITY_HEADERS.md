# Mercury Call Desk — HTTP Security Headers

Mercury Call Desk applies a conservative global security-header baseline from `next.config.mjs` to every application path.

## Single source of truth

`next.config.mjs` is the only application source allowed to define the global HTTP security-header baseline.

`middleware.ts` remains responsible only for the existing NextAuth authorization wrapper and route matcher. It must not set response security headers. Keeping authentication middleware free of header mutations prevents a partial or older middleware copy from overriding or drifting away from the global configuration.

The source guard fails if security-header names or `response.headers.set(...)` calls are added back to middleware.

## Header baseline

| Header | Value / policy | Purpose |
|---|---|---|
| `Content-Security-Policy` | `base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'` | Restricts base URL injection, form submission targets, framing, and plugin/object content without constraining Next.js scripts, styles, images, or API connections. |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing. |
| `X-Frame-Options` | `DENY` | Legacy clickjacking protection in addition to CSP `frame-ancestors`. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits cross-origin referrer detail while preserving same-origin diagnostics. |
| `Permissions-Policy` | camera, microphone, geolocation, payment, USB, and browsing topics disabled | Prevents unused browser capabilities from being granted to the app. |
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` | Isolates the browsing context while retaining compatibility with legitimate popup-based flows. |
| `X-DNS-Prefetch-Control` | `off` | Disables speculative DNS prefetching. |
| `X-Permitted-Cross-Domain-Policies` | `none` | Disables legacy cross-domain policy files. |
| `X-Download-Options` | `noopen` | Prevents legacy browsers from opening downloaded content in the site context. |

Vercel supplies `Strict-Transport-Security`; Production Smoke verifies that it remains present.

## Conservative Content Security Policy

The CSP is intentionally limited to directives that are safe for the current Next.js application without requiring nonces or external-domain inventories. It does **not** set `default-src`, `script-src`, `style-src`, `img-src`, or `connect-src`, so it does not alter existing asset loading or server/API behavior.

Do not add `unsafe-eval`, wildcard framing, wildcard base URLs, or wildcard form targets. A stricter resource-loading CSP should be introduced only with browser-level validation of login, MFA, admin, portal, GHL handoff, and Vercel preview/tooling behavior.

## Automated verification

`npm run check:http-security-headers` protects the single-source configuration, authentication-only middleware boundary, documentation, build wiring, and Production Smoke assertions.

Production Smoke checks the deployed headers on:

- `/api/status`;
- `/login`;
- unauthenticated Project Readiness page/API boundaries;
- unauthenticated Servicing Preflight page/API boundaries.

A missing or changed header causes the post-deploy smoke to fail.

## Safety boundary

This hardening centralizes existing response-header configuration only. It does not change the NextAuth wrapper, middleware matcher, authentication, authorization rules, application or database state, feature gates, GHL behavior, migrations, Commission/Finance data, payments, or payouts.
