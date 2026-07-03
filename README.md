# Mercury Call Desk — Mini CRM (`crm.mcd`)

Secure Agent and Admin portals for Mercury Call Desk. GoHighLevel (GHL) is a backend integration only; agents never receive GHL credentials. Neon PostgreSQL is the system of record, and GitHub `main` deploys to Vercel production.

## Handoff Entry Points

- [Project operating instructions](./CLAUDE.md)
- [Documentation index](./docs/INDEX.md)
- [Daily log](./docs/DAILY_LOG.md)
- [V1 rebuild specification](./docs/REBUILD_V1_SPEC.md)
- [Preview environment isolation](./docs/REBUILD_V1_PREVIEW_ENVIRONMENT.md)
- [Codebase rebuild audit](./docs/CODEBASE_AUDIT.md)
- [Database schema inventory](./docs/DATABASE_SCHEMA_INVENTORY.md)

## Production Workflow

- `main` is the production source branch.
- Vercel deploys changes from `main` to `https://crm.mercurycalldesk.com`.
- Production environment values live in Vercel only; never commit credentials.
- Neon schema changes use a safety-branch review before an explicit production apply.
- Do not enable a database-backed feature until its schema, production build, and controlled live test are complete.
- Do not run a blanket `prisma migrate deploy` against production; use the documented database-release process and recorded production baseline.

## Current Controlled Rebuild — 2026-07-03

- **Known-good recovery baseline:** `recovery/e59-route-fix` at `92c052a`.
- **Rebuild foundation:** `rebuild/v1-foundation`.
- **Active workspace branch:** `rebuild/m1-role-shell`.
- **Audit documentation branch:** `docs/rebuild-audit-2026-07-03`.
- **Milestone 1 Preview:** `https://crm-mcd-git-rebuild-m1-role-shell-hamiltons-projects-f65eeb81.vercel.app`.
- **Preview database:** Neon branch `preview-rebuild-v1` (`br-twilight-snow-aj4widc4`).
- **Production posture:** `main`, production Vercel, production Neon schema, and production data are frozen pending explicit owner approval after Preview acceptance.
- **Confirmed:** Owner credentials + MFA reached `/admin` successfully on the isolated Preview database.
- **Still required:** Agent credentials + MFA must be tested to `/portal`, with direct Admin access denied.
- **Schema gate:** the client-servicing SQL migration is present and matches Preview, but its four tables are absent from `prisma/schema.prisma`. Reconcile Prisma to the approved SQL baseline before servicing, commission, House-transfer, or migration work.

## Stack

- Next.js 15 App Router + TypeScript
- Tailwind CSS dark interface
- Prisma ORM + Neon PostgreSQL
- Auth.js / NextAuth v5 credentials sessions + TOTP MFA
- Vercel production deployment
- GHL backend integration

## Implemented Foundation

- Public partner signup at `/signup` with validation, honeypot, GHL stub-safe contact upsert, submitted-agent creation, four document gates, and audit history.
- Auth foundation: credentials login, role-gated routes, Argon2 password hashing, one-time activation tokens stored as hashes, account lockout, JWT sessions, and TOTP MFA enrollment.
- Admin operations: applicant review, confirmation call, approval/correction/rejection, certification workflow, command center, integration error review, audit history/export, user administration, account-security view, and module-readiness view.
- GHL document-completion webhook with shared secret, location allowlist, idempotency, onboarding document updates, invited-user provisioning, activation-link generation, and audit events.
- Security response headers plus branded error/not-found fallbacks.
- **Lead MVP:** production schema, agent workspace, controlled imports, admin review, Open Pool protection, DNC/suppression, callbacks, and inbound GHL appointment attribution are deployed behind the Lead feature gate.

## Milestone 1: Role-Aware Workspace Shell

Current Preview-only changes on `rebuild/m1-role-shell`:

- Protected Admin workspace header and navigation.
- Role-aware `/admin` overview.
- Applicant Review available at `/admin/applicants` for Owner, Super Admin, and Sales Manager roles.
- Existing Partner Portal available from Admin.
- Server-side authorization remains mandatory for Admin routes.

This milestone does **not** change authentication, database schema, lead/client records, commissions, GHL behavior, or production.

## Historical Lead MVP Status

- **Database:** Lead MVP schema exists in production.
- **Feature gate:** `LEADS_ENABLED=false`; agents cannot access Lead workflows until owner acceptance testing is complete.
- **Historical rollout reference:** [Lead MVP Rollout Status](./docs/LEAD_MVP_ROLLOUT_STATUS.md)
- **Historical test reference:** [Lead MVP Acceptance Test](./docs/LEAD_MVP_ACCEPTANCE_TEST.md)

These documents do not authorize enabling Lead workflows or changing production during the controlled rebuild.

## Module Status

| Module | Feature gate | Current status |
|---|---:|---|
| Admin and Agent role shell | none | Rebuilding in Preview; Milestone 1 acceptance in progress |
| Lead pools, claim, activity, DNC, workspace | `LEADS_ENABLED` | Historical implementation exists; disabled and excluded from active rebuild until its dedicated milestone |
| Booking attribution and appointment relay | uses lead module | Historical implementation exists; no active Preview integration testing |
| Client servicing and health | `SERVICING_ENABLED` | Historical schema and workspace exist; feature disabled; Prisma reconciliation required before rebuild work |
| Commission calculations and funding validation | `COMMISSIONS_ENABLED` | Staged; disabled |
| Finance/payout eligibility | `FINANCE_ENABLED` | Staged; disabled |

## Core Business Rules Encoded in Source

- Cold lead protection begins after documented two-way contact, not when an agent claims a record.
- Documented referrals are protected on entry; new imports cannot be assigned directly to Open Pool.
- Open Pool is reserved for eligible, audited returns from previously assigned non-referral records with documented two-way contact.
- Demo-booked records are not returned to Open Pool through normal new-import review.
- DNC suppresses calls, SMS, sales email, marketing email, and social outreach immediately.
- Healthy, current-paying accounts are not reassigned solely because there is no routine activity.
- Departing agents in good standing retain commission eligibility only while servicing assigned clients. Retirees retain eligibility; terminated agents lose future eligibility and accounts transfer to House.
- Finance approval, cleared funds, eligibility timing, no hold, and payout-provider readiness are required before a payout. The CRM never auto-pays.

## Security and Compliance Guardrails

- Never store SSNs, tax IDs, raw bank/routing details, payment card data, or provider credentials in the CRM.
- Store only provider references for signed documents and payouts.
- Secrets are server-only environment values.
- Sensitive actions write to `AuditLog`.
- All protected actions authorize server-side; client input is not trusted.
- GHL links, other-client data, confidential wholesale pricing, commission mechanics, scripts, and ICP data are not exposed to agents by default.
- Preview external integrations require an explicit application-level test/preview guard before they are enabled; Vercel variable scoping is not sufficient by itself.

## Immediate Next Sequence

1. Accept or revise the Milestone 1 Admin workspace Preview.
2. Run the pending Agent MFA → `/portal` and denied direct `/admin` acceptance checks in Preview.
3. Inspect runtime logs and record the outcome in `docs/DAILY_LOG.md`.
4. Reconcile the Prisma schema with the approved client-servicing SQL migration without applying a database change.
5. Use the accepted Milestone 1 branch as the basis for the next focused rebuild milestone.
6. Do not enable `LEADS_ENABLED`, run external integrations, alter production, or apply database migrations without explicit owner approval.
