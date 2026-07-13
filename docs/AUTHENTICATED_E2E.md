# Mercury Call Desk — Authenticated E2E Foundation

## Purpose

The authenticated E2E workflow verifies real browser session and credential-security behavior without using production accounts, production databases, preview databases, Vercel credentials, or external integrations.

## Covered browser boundaries

The suite covers:

1. unauthenticated Admin and Agent routes redirect to `/login`;
2. unknown accounts and known accounts with a wrong password receive the same generic public failure;
3. a synthetic Owner signs in through the real credentials form and reaches `/admin`;
4. the Owner can open the protected Build Guard Registry control plane;
5. signing out invalidates access to protected Admin routes;
6. a synthetic Agent signs in and reaches `/portal`;
7. the Agent cannot cross the Admin route boundary;
8. the Agent session remains valid for the Agent portal after the denied Admin navigation;
9. a synthetic MFA Owner receives the required-code challenge;
10. an invalid TOTP is rejected and the current generated TOTP completes the real sign-in flow;
11. five failed password attempts lock a dedicated synthetic account, and the correct password remains blocked during the lockout window.

## Disposable environment

`.github/workflows/authenticated-e2e.yml` starts PostgreSQL 17 with database `crm_e2e` on `127.0.0.1`.

The workflow:

- installs dependencies;
- creates the schema with `prisma db push` against the local service only;
- seeds four synthetic accounts;
- installs Chromium;
- starts the Next.js development server on `127.0.0.1:3000`;
- runs the Playwright suite with one worker and no retries because lockout is intentionally stateful;
- retains traces, screenshots, videos, and the HTML report only when the job fails.

No repository or account secret is required. All credentials and the TOTP seed are fixed synthetic values scoped to the disposable job.

## Seed safety sentinels

`scripts/seed-auth-e2e.ts` refuses to run unless all of these conditions are true:

- `E2E_ALLOW_DISPOSABLE_DB=true`;
- `VERCEL_ENV` is absent;
- both `DATABASE_URL` and `DIRECT_URL` use PostgreSQL;
- both database hosts are localhost-only;
- both database names contain an isolated `e2e` token;
- all four synthetic passwords are present and at least 12 characters;
- the synthetic MFA secret satisfies the Base32 format contract.

The seed uses only idempotent `User` and `Agent` upserts for:

- `e2e.owner@mercurycalldesk.test`;
- `e2e.agent@mercurycalldesk.test`;
- `e2e.mfa@mercurycalldesk.test`;
- `e2e.lockout@mercurycalldesk.test`.

Every run resets failed-login and lockout fields on the synthetic users before the browser suite begins. The MFA identity is the only synthetic user with `mfaEnabled=true` and receives the fixed test-only TOTP secret.

The seed does not delete data, execute raw SQL, create Leads, create Client Accounts or Service Cases, touch Commission/Payout records, or call external services.

## MFA contract

The browser uses `otplib` to generate a current six-digit TOTP from the synthetic secret. It first submits the valid password without a code, then submits a deliberately altered current code, and finally submits a freshly generated valid code. This exercises the real `MFA_REQUIRED`, `MFA_INVALID`, and successful credentials-session paths.

## Lockout contract

The production authentication source defines five failed logins and a 15-minute lockout. The test uses a dedicated synthetic identity so the account-enumeration and normal login scenarios cannot consume its failure counter. It submits five wrong passwords, then confirms that the correct password receives the temporary-lock public message instead of creating a session.

## Browser target safety

`playwright.auth.config.ts` accepts only `127.0.0.1`, `localhost`, or `::1` and rejects any Vercel environment. The tests contain relative application paths only and cannot target production or preview hosts.

## Feature and integration isolation

The workflow explicitly keeps these gates disabled:

- `LEADS_ENABLED=false`;
- `SERVICING_ENABLED=false`;
- `COMMISSIONS_ENABLED=false`;
- `FINANCE_ENABLED=false`.

GHL and SMTP credentials are empty. The suite does not invoke signup, activation, imports, exports, controlled tests, cron, or webhook endpoints.

## Local execution

Use an isolated local PostgreSQL database whose name contains `e2e`, then set the same synthetic variables used by CI. Run:

```bash
npm install
npx prisma db push
npm run seed:e2e-auth
npx playwright install chromium
npm run test:e2e:auth
```

Never point these commands at Neon, Vercel, a shared development database, or production.
