# Mercury Call Desk — Authenticated E2E Foundation

## Purpose

The authenticated E2E workflow verifies real browser session, credential-security, live authorization, persisted account-state, and audit behavior without using production accounts, production databases, preview databases, Vercel credentials, or external integrations.

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
9. an already-issued Owner session loses protected access immediately after the underlying User becomes `SUSPENDED`;
10. an already-issued Owner session loses Admin access immediately after the underlying role changes to `AGENT`;
11. that same role-changed session can reach the Agent portal using the current database role and Agent profile;
12. a synthetic MFA Owner receives the required-code challenge, rejects an invalid TOTP, and accepts the current generated TOTP;
13. five failed password attempts lock a dedicated synthetic account, and the correct password remains blocked during the lockout window.

## Disposable environment

`.github/workflows/authenticated-e2e.yml` starts PostgreSQL 17 with database `crm_e2e` on `127.0.0.1`.

The workflow:

- installs dependencies;
- creates the schema with `prisma db push` against the local service only;
- seeds six synthetic accounts and two synthetic Agent profiles;
- installs Chromium;
- starts the Next.js development server on `127.0.0.1:3000`;
- runs the Playwright suite with one worker and no retries because lockout and live-session changes are intentionally stateful;
- runs read-only persisted security assertions against the same disposable database;
- retains traces, screenshots, videos, and the HTML report only when the job fails.

No repository or account secret is required. All credentials and the TOTP seed are fixed synthetic values scoped to the disposable job.

## Seed safety sentinels

`scripts/seed-auth-e2e.ts` refuses to run unless all of these conditions are true:

- `E2E_ALLOW_DISPOSABLE_DB=true`;
- `VERCEL_ENV` is absent;
- both `DATABASE_URL` and `DIRECT_URL` use PostgreSQL;
- both database hosts are localhost-only;
- both database names contain an isolated `e2e` token;
- all six synthetic passwords are present and at least 12 characters;
- the synthetic MFA secret satisfies the Base32 format contract.

The seed uses only idempotent `User` and `Agent` upserts for:

- `e2e.owner@mercurycalldesk.test`;
- `e2e.agent@mercurycalldesk.test`;
- `e2e.mfa@mercurycalldesk.test`;
- `e2e.lockout@mercurycalldesk.test`;
- `e2e.suspended-session@mercurycalldesk.test`;
- `e2e.role-change@mercurycalldesk.test`.

Every run resets status, role, failed-login, and lockout fields on the synthetic users before the browser suite begins. The MFA identity is the only synthetic user with `mfaEnabled=true`. The role-change identity starts as Owner but already has a disabled-claim Agent profile so a mid-session role change can be tested without creating business records during the browser run.

The seed does not delete data, execute raw SQL, create Leads, create Client Accounts or Service Cases, touch Commission/Payout records, or call external services.

## MFA contract

The browser uses `otplib` to generate a current six-digit TOTP from the synthetic secret. It first submits the valid password without a code, then submits a deliberately altered current code, and finally submits a freshly generated valid code. This exercises the real `MFA_REQUIRED`, `MFA_INVALID`, and successful credentials-session paths.

## Lockout contract

The production authentication source defines five failed logins and a 15-minute lockout. The test uses a dedicated synthetic identity so the account-enumeration and normal login scenarios cannot consume its failure counter. It submits five wrong passwords, then confirms that the correct password receives the temporary-lock public message instead of creating a session.

## Live session enforcement

The application uses JWT sessions, but protected server pages and APIs call `requireUser`, which reloads the current User from PostgreSQL. `requireUser` rejects missing or non-`ACTIVE` users, and `requireRole` checks the freshly loaded database role.

The browser suite proves this behavior after a session has already been issued:

- a synthetic Owner signs in successfully, is changed to `SUSPENDED` in the disposable database, and is denied on the next protected Admin navigation;
- a second synthetic Owner signs in successfully, is changed to `AGENT`, loses Admin access, and can then reach the Agent portal without reissuing the session.

`tests/e2e/auth/disposable-auth-state.ts` is the only mutation helper. It repeats the localhost/PostgreSQL/`e2e`/Vercel sentinels, accepts only the two dedicated synthetic email addresses, permits only `ACTIVE`/`SUSPENDED` status and `OWNER`/`AGENT` role values, and updates only `User.status` or `User.role`. It cannot access audit, Lead, Agent, Servicing, Commission, Payout, or integration tables and cannot call external services.

## Persisted security evidence

After Playwright completes, `scripts/assert-auth-e2e-security-state.ts` performs read-only assertions against the disposable database.

It verifies:

- the Owner's initial wrong-password counter was reset by the later successful login;
- the Owner has ordered `LOGIN_FAILED`, `LOGIN_SUCCESS`, and `LOGOUT` evidence;
- the normal Agent remains unlocked and has `LOGIN_SUCCESS` evidence;
- MFA-required and invalid-code attempts created `LOGIN_FAILED` rows with reasons `MFA_REQUIRED` and `MFA_INVALID`;
- the valid MFA login created `LOGIN_SUCCESS` without incrementing password lock counters;
- the lockout identity persists exactly five failed logins and a future `lockedUntil` timestamp;
- the lockout audit counters are exactly `1, 2, 3, 4, 5`;
- exactly one `ACCOUNT_LOCKED` row exists and its ISO timestamp matches `User.lockedUntil`;
- the locked identity has no successful-login timestamp or `LOGIN_SUCCESS` audit row;
- the suspended-session identity retains Owner login evidence but persists `SUSPENDED` status without lockout state;
- the role-change identity persists current role `AGENT`, remains active and unlocked, and retains Owner-role login evidence from the session issuance event.

The assertion script selects only the six synthetic `User` rows and their `LOGIN_FAILED`, `ACCOUNT_LOCKED`, `LOGIN_SUCCESS`, and `LOGOUT` audit rows. It contains no create, update, upsert, delete, transaction, raw-SQL, business-table, or external-call operation and repeats the same localhost/PostgreSQL/`e2e`/Vercel safety sentinels.

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
npm run assert:e2e-auth-security
```

Never point these commands at Neon, Vercel, a shared development database, or production.
