# Mercury Call Desk — Route Boundary Registry

The Route Boundary Registry is a source-derived inventory of direct request parsing, direct response construction, and named error-message use inside Next.js route handlers.

## Source-derived inventory

`npm run check:route-boundary-registry` recursively scans every `src/app/**/route.ts` file for:

- `request.json()` or `req.json()`;
- `request.text()` or `req.text()`;
- direct `NextResponse.json()` construction;
- direct `new NextResponse()` construction;
- `error.message` returned from a route.

The scanner compares the exact route path, primitive category, and occurrence count with `config/route-boundary-registry.json`.

Any added primitive, removed primitive, or changed count fails the build until the registry is explicitly reviewed and updated. Removing a finding is therefore visible too; the baseline cannot silently become stale.

## Classifications

Each finding must be classified as:

- `APPROVED_EXCEPTION` — a purpose-built boundary with documented safeguards and a reviewed reason not to use a shared helper;
- `FROZEN_EXISTING` — known debt that must not grow and should be prioritized for removal.

Every finding requires a non-empty rationale. Duplicate entries, invalid classifications, invalid counts, missing review dates, and drift all fail CI.

The current PR #128 baseline contains **6 approved findings across 4 routes** and zero frozen findings. PR #127 initially established 11 findings across 8 routes; five signed-import route findings were removed by centralizing typed domain-error mapping.

## Current reviewed exceptions

The current findings cover only:

- public account activation raw-body limits and its route-local response helper;
- public partner signup raw-body limits and minimal privacy-preserving response helper;
- the secret-authenticated aging cron's conditional `Retry-After` response helper;
- the intentionally minimal public deployment-status response.

Signed Lead-import typed errors no longer appear as route-level findings. They are mapped centrally by `leadImportDomainErrorResponse`, while unknown failures remain generic.

These classifications are not permanent exemptions. Any code or count change requires a new source review, and a shared-helper migration may remove a finding from the baseline.

## Protected control plane

- Page: `/admin/route-boundaries`
- API: `/api/admin/route-boundaries`

Both require an Admin role. The API uses the shared no-store/noindex/request-ID response contract and returns role-only viewer metadata.

The control plane exposes only:

- route paths;
- primitive categories;
- occurrence counts;
- classifications;
- reviewed rationales;
- aggregate totals.

It does not expose route source contents, request bodies, runtime payloads, database records, credentials, customer information, or internal user IDs.

## Regression coverage

`npm run check:route-boundary-control-plane` protects:

- the exact reviewed baseline;
- static JSON import rather than runtime filesystem scanning;
- aggregate snapshot fields;
- protected page and API contracts;
- role-only viewer metadata;
- absence of database access and mutation primitives;
- Settings navigation;
- documentation, build, and deployment-verification wiring.

## Safety boundary

The scanner and control-plane guards read repository files only during build. They do not invoke any route, authenticate into the application, query production, read customer data, create imports, run exports, trigger cron, call GHL, change feature flags, apply migrations, activate Commission or Finance systems, or move money.
