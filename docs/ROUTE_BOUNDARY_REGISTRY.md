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

A non-empty finding must be classified as:

- `APPROVED_EXCEPTION` — a purpose-built boundary with documented safeguards and a reviewed reason not to use a shared helper;
- `FROZEN_EXISTING` — known debt that must not grow and should be prioritized for removal.

Every non-empty finding requires a rationale. Duplicate entries, invalid classifications, invalid counts, missing review dates, and drift all fail CI.

The current PR #130 baseline contains **zero reviewed findings** and zero frozen debt.

Baseline history:

- PR #127: 11 findings across 8 routes;
- PR #128: 6 findings across 4 routes after centralizing signed-import typed domain errors;
- PR #129: 2 findings across 2 routes after centralizing public/cron/status JSON response construction;
- PR #130: 0 findings after centralizing the final bounded public raw-body reads.

## Zero-finding state

No `src/app/**/route.ts` file currently contains a scanned direct primitive.

- Public activation and signup use `preparePublicJsonBody` for declared-size checks, bounded raw reads, actual UTF-8 checks, and JSON parsing.
- Public activation, signup, Lead-aging cron, and status use `routeJsonResponse` for response construction.
- Signed Lead-import typed errors use `leadImportDomainErrorResponse`.
- Other authenticated route families use their existing shared request/response boundaries.

The zero-finding state is not a scanner bypass. The scanner still walks every route and fails CI if a future direct parser, response constructor, or route-level raw error message appears without a matching reviewed registry update.

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

With a zero-finding baseline, the current totals are zero and the findings list is empty.

It does not expose route source contents, request bodies, runtime payloads, database records, credentials, customer information, or internal user IDs.

## Regression coverage

`npm run check:route-boundary-control-plane` protects:

- the exact reviewed baseline, including zero findings;
- static JSON import rather than runtime filesystem scanning;
- aggregate snapshot fields;
- protected page and API contracts;
- role-only viewer metadata;
- absence of database access and mutation primitives;
- Settings navigation;
- documentation, build, and deployment-verification wiring.

`npm run check:shared-route-json-boundary` protects shared response adoption and the zero-finding baseline.

`npm run check:public-json-body-boundary` protects the final public request-body extraction and exact failure contracts.

## Safety boundary

The scanner and control-plane guards read repository files only during build. They do not invoke any route, authenticate into the application, query production, read customer data, create imports, run exports, trigger cron, call GHL, change feature flags, apply migrations, activate Commission or Finance systems, or move money.
