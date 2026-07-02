# Mercury Call Desk — Mini CRM (`crm.mcd`)

Secure Agent and Admin portals for Mercury Call Desk. GoHighLevel (GHL) is a backend integration only; agents never receive GHL credentials. Neon PostgreSQL is the system of record, and GitHub `main` deploys to Vercel production.

## Production workflow

- `main` is the production source branch.
- Vercel deploys changes from `main` to `https://crm.mercurycalldesk.com`.
- Production environment values live in Vercel only; never commit credentials.
- Neon schema changes use a safety-branch review before an explicit production apply.
- Do not enable a database-backed feature until its schema, production build, and controlled live test are complete.
- Do not run a blanket `prisma migrate deploy` against production; use the documented database-release process and recorded production baseline.

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
- **Lead MVP:** production schema, agent workspace, controlled imports, admin review, Open Pool protection, DNC/suppression, callbacks, and inbound GHL appointment attribution are deployed behind the Lead feature gate.

## Current Lead MVP status

- **Database:** Lead MVP schema is applied and validated in production.
- **Application:** Latest Lead MVP production deployment is `READY`.
- **Feature gate:** `LEADS_ENABLED=false`; agents cannot access Lead workflows until owner acceptance testing is complete.
- **Activation handoff:** [Lead MVP Rollout Status](./docs/LEAD_MVP_ROLLOUT_STATUS.md)
- **Test plan:** [Lead MVP Acceptance Test](./docs/LEAD_MVP_ACCEPTANCE_TEST.md)

## Module status

| Module | Feature gate | Current status |
|---|---:|---|
| Lead pools, claim, activity, DNC, workspace | `LEADS_ENABLED` | Schema and app deployed; held for owner acceptance testing |
| Booking attribution and appointment relay | uses lead module | Inbound appointment attribution deployed behind Lead gate; outbound GHL booking endpoint contract remains pending |
| Commission calculations and funding validation | `COMMISSIONS_ENABLED` | Staged; disabled |
| Client servicing cadence and health | `SERVICING_ENABLED` | Staged; disabled |
| Finance/payout eligibility | `FINANCE_ENABLED` | Staged; disabled |

## Core business rules encoded in source

- Cold lead protection begins after documented two-way contact, not when an agent claims a record.
- Documented referrals are protected on entry; new imports cannot be assigned directly to Open Pool.
- Open Pool is reserved for eligible, audited returns from previously assigned non-referral records with documented two-way contact.
- Demo-booked records are not returned to Open Pool through normal new-import review.
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

1. Review the [Lead MVP Rollout Status](./docs/LEAD_MVP_ROLLOUT_STATUS.md).
2. Execute and sign off on the [Lead MVP Acceptance Test](./docs/LEAD_MVP_ACCEPTANCE_TEST.md).
3. Enable `LEADS_ENABLED=true` only for the controlled acceptance test window.
4. Run a small approved batch through import → review → claim → activity/callback → DNC → appointment attribution.
5. Stabilize the Lead MVP and monitor audit and runtime logs.
6. Start Client Servicing Health only after owner authorization.
