# Mercury Call Desk — Production Smoke

The `Production Smoke` GitHub Actions workflow verifies the deployed production boundary after every push to `main`, on manual dispatch, and every six hours.

## What it checks

1. `https://crm.mercurycalldesk.com/api/status` returns HTTP 200 JSON with:
   - `ok: true`;
   - service `crm-mcd`;
   - environment `production`;
   - branch `main`;
   - a valid 40-character commit SHA;
   - deployment URL and region;
   - `Cache-Control: no-store`.
2. For a `main` push, the runner polls until production reports the exact GitHub commit that triggered the workflow.
3. `/login` returns the branded Mercury Call Desk sign-in surface and remains `noindex, nofollow`.
4. Unauthenticated requests to these protected routes resolve to `/login` and do not expose their protected markers:
   - `/admin/project-readiness`;
   - `/api/admin/project-readiness`;
   - `/admin/servicing/acceptance-command-center`;
   - `/api/admin/servicing/acceptance-readiness`.

The job writes a compact result table to the GitHub Actions step summary.

## Triggers

- Every push to `main`.
- Manual `workflow_dispatch` from `main`.
- Scheduled run at minute 17 every six hours.

The workflow uses read-only repository permissions and cancels an older in-progress smoke run when a newer `main` run starts.

## Local or operator run

```bash
PRODUCTION_BASE_URL=https://crm.mercurycalldesk.com \
EXPECTED_COMMIT_SHA=<40-character-main-sha> \
npm run smoke:production
```

Optional controls:

- `SMOKE_MAX_ATTEMPTS` — deployment polling attempts, default `30`.
- `SMOKE_RETRY_SECONDS` — delay between attempts, default `15`.
- `SMOKE_REQUEST_TIMEOUT_MS` — per-request timeout, default `15000`.

## Failure meaning

A failure means at least one of these contracts changed or production did not converge to the expected `main` commit within the polling window. Investigate the Vercel deployment, `/api/status`, authentication middleware, or route protection before treating the release as healthy.

## Safety boundary

The smoke runner does not authenticate, submit credentials, call a server action, or access protected data. It does not mutate Leads, Client Accounts, Service Cases, audit records, feature flags, GHL workflows, Commission or Finance state, payment providers, or payouts. It uses GET requests only and validates the public deployment and unauthenticated security boundary.
