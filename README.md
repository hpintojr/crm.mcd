# Mercury Call Desk — Mini CRM (`crm.mcd`)

Secure Agent and Admin portals for Mercury Call Desk. GoHighLevel (GHL) is a backend integration only; agents never receive GHL credentials. Neon PostgreSQL is the system of record, and GitHub `main` deploys to Vercel production.

## Production workflow

- `main` is the production source branch.
- Vercel deploys changes from `main` to `https://crm.mercurycalldesk.com`.
- Production environment values live in Vercel only; never commit credentials.
- Neon schema changes use a safety-branch review before an explicit production apply.
- No local-machine workflow is required for normal development or operation.
- Do not enable a database-backed feature until its migration, production build, and controlled live test are complete.

## Stack

- Next.js 15 App Router + TypeScript
- Tailwind CSS dark interface
- Prisma ORM + Neon PostgreSQL
- Auth.js / NextAuth v5 credentials sessions + TOTP MFA
- Vercel production deployment
- GHL backend integration

## Implemented foundation

- Public partner signup at `/signup` with validation, honeypot, GHL stub-safe contact upsert, submitted-agent creation, four document gates, and audit history.
- Auth foundation: credentials login, role-gated routes, Argon2 password hashing, one-time activation tokens stored as hashes, account lockout, JWT sessions, and TOTP MFA enrollment.
- Admin operations: applicant review, confirmation call, approval/correction/rejection, certification workflow, command center, integration error review, audit history/export, user administration, account-security view, and module-readiness view.
- GHL document-completion webhook with shared secret, location allowlist, idempotency, onboarding document updates, invited-user provisioning, activation-link generation, and audit events.
- Security response headers plus branded error/not-found fallbacks.

## Staged modules

The following source code and migration files exist but remain intentionally disabled until controlled Neon rollout and production tests are complete:

| Module | Feature gate | Status |
|---|---:|---|
| Lead pools, claim, activity, DNC, workspace | `LEADS_ENABLED` | Migration staged; disabled |
| Booking attribution and appointment relay | uses lead module | Partial; outbound GHL booking still needs verified endpoint contract |
| Commission calculations and funding validation | `COMMISSIONS_ENABLED` | Ledger migration staged; disabled |
| Client servicing cadence and health | `SERVICING_ENABLED` | Client/service migration staged; disabled |
| Finance/payout eligibility | `FINANCE_ENABLED` | Payout migration staged; disabled |

Staged migrations:

```txt
prisma/migrations/20260701091000_add_lead_engine/migration.sql
prisma/migrations/20260701091100_add_lead_integrity/migration.sql
prisma/migrations/20260701092000_add_client_service_and_ledger/migration.sql
```

Apply them only through the controlled Neon safety-branch process and in that order.

## Core business rules encoded in source

- Cold lead protection begins after documented two-way contact, not when an agent claims a record.
- Documented referrals are protected on entry; demo-booked records do not return to OpenPool.
- DNC suppresses calls, SMS, sales email, marketing email, and social outreach immediately.
- Healthy, current-paying accounts are not reassigned solely because there is no routine activity.
- Departing agents in good standing retain commission eligibility only while servicing assigned clients. Retirees retain eligibility; terminated agents lose future eligibility and accounts transfer to House.
- Finance approval, cleared funds, eligibility timing, no hold, and payout-provider readiness are required before a payout. The CRM never auto-pays.

## Security and compliance guardrails

- Never store SSNs, tax IDs, raw bank/routing details, payment card data, or provider credentials in the CRM.
- Store only provider references for signed documents and payouts.
- Secrets are server-only environment values.
- Sensitive actions write to `AuditLog`.
- All protected actions authorize server-side; client input is not trusted.
- GHL links, other-client data, confidential wholesale pricing, commission mechanics, scripts, and ICP data are not exposed to agents by default.

## Immediate next sequence

1. Verify the latest `main` deployment in Vercel.
2. Verify owner activation and `/admin` access.
3. Test the lead migration and integrity migration on a Neon safety branch.
4. Apply lead migrations to production only with explicit approval.
5. Run controlled tests for intake, claim race, callback, DNC, release, and inbound GHL appointment events.
6. Enable `LEADS_ENABLED=true` only after those tests pass.
7. Stabilize leads before applying the client/service/ledger migration.
