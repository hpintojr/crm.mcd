# Mercury Call Desk — Mini CRM (`crm.mcd`)

Secure Admin and Agent portals for Mercury Call Desk. GoHighLevel (GHL) is a backend integration only; agents never receive GHL credentials. Neon PostgreSQL is the system of record, and GitHub `main` deploys to Vercel production.

## Start here

- [Project Readiness Control Plane](/admin/project-readiness) — deployed commit, feature gates, acceptance, integrations, and live schema readiness in one protected read-only view.
- [Workspace](./docs/WORKSPACE.md) — current implementation inventory, gates, operational paths, and test plan.
- [Lead MVP Rollout Status](./docs/LEAD_MVP_ROLLOUT_STATUS.md) — Lead, GHL relay, and servicing handoff status.
- [Lead MVP Acceptance Test](./docs/LEAD_MVP_ACCEPTANCE_TEST.md) — owner-controlled test sequence.
- [Documentation Index](./docs/INDEX.md)
- [Working Instructions](./CLAUDE.md)

## Production workflow

- `main` is the production source branch.
- Vercel deploys changes from `main` to `https://crm.mercurycalldesk.com`.
- Production environment values live in Vercel only; never commit credentials.
- Neon schema changes use a disposable safety branch before an explicit production apply.
- Do not enable a database-backed feature until its schema, production build, and controlled live test are complete.
- Do not run a blanket `prisma migrate deploy` against production.
- Do not assume a feature-gate value from documentation; verify the deployed environment and `/admin/project-readiness` before activation or status reporting.

## Stack

- Next.js 15 App Router + TypeScript
- Tailwind CSS dark interface
- Prisma ORM + Neon PostgreSQL
- Auth.js / NextAuth v5 credentials sessions + TOTP MFA
- Vercel production deployment
- GHL backend integration

## What is implemented

### Agent onboarding and access controls

- Partner signup, credentials authentication, activation, MFA, role-gated pages, lockout protections, and audit history.
- Admin document tracking for Sales Agreement, NDA/IP, W-9/entity acknowledgment, and New Hire Acknowledgment.
- Company/entity name support on the Agent profile for W-9/entity test coverage; no tax forms, tax identifiers, banking information, signatures, or raw document contents are stored in the MiniCRM.
- Manager-recorded certification with scores, decision history, audit evidence, and Lead eligibility control.
- Agent Training workspace readiness summary: document count, certification decision, and Lead eligibility state.

### Lead operations

- Signed batch import workflow plus controlled JSON/CSV conversion with server-side preview-before-commit.
- Admin review, duplicate/suppression screening, source/intake validation, and no direct new-import path into Open Pool.
- Atomic claim controls, agent ownership boundaries, notes, dispositions, callbacks, two-way contact, and audit history.
- Immediate DNC and admin suppression protections that cancel scheduled callbacks and remove active-work access.
- Wrong-number and out-of-business invalid-contact suppression.
- Open Pool return protections requiring documented prior ownership, two-way contact, non-referral status, eligible lifecycle, and admin reason.
- Lead detail view with an admin-only verified Closed Won decision.
- Warm Reply Triage for unassigned verified inbound replies, with atomic manager assignment and immediate callback creation.
- The 18-step production Lead Flow acceptance runbook and owner production decision are recorded PASS.

### GHL relays

- Appointment lifecycle relay at `/api/ghl/appointments`.
- Opportunity result relay at `/api/ghl/opportunities`.
- Inbound SMS/email reply relay at `/api/ghl/replies`.
- All relay paths use verified webhook handling, location allowlisting, event-ID idempotency, audit events, and Integration Monitor errors.
- Appointment time parsing has been hardened for GHL date formats and timezone handling.
- Controlled test harness coverage exists; live external GHL workflow configuration remains a separately controlled owner action.

### Client Servicing

- Closed Won onboarding queue, client account creation guard, launch confirmations, account detail, service-case queue, response/resolution controls, and owner/House transfer controls.
- Linked Client Accounts can only be created from active, verified, non-suppressed `CLOSED_WON` Leads; duplicate links are rejected under a transaction lock.
- Healthy, current-paying accounts are not reassigned merely because they are quiet.
- Service cases are trigger-based: client request, support issue, payment problem, renewal event, escalation, or documented review.
- Client/Service raw-SQL tables are present in production; normal Servicing use remains feature-gated pending a separately authorized acceptance window.

### Commission and Finance readiness

- Commission eligibility, agent profile, ledger read models, hold/release policy, review actions, and acceptance-board scaffolding are built behind the Commission feature gate.
- PR #100 corrected the staged Commission/Payout migration to match the raw SQL used by the application and added `CommissionHold`, `CommissionEligibilityDecision`, and `AgentCommissionProfile`.
- The exact PR #100 DDL passed disposable-Neon-branch catalog and lifecycle testing, but it has **not** been applied to production.
- Finance remains a readiness-only boundary. It does not store raw financial-account data, initiate payment-provider actions, or move money.

### Acceptance, readiness, and audit

- Lead, Servicing, and Commission acceptance boards record Pass, Fail, or Deferred evidence with admin identity, note, and timestamp.
- `/admin/project-readiness` combines deployment metadata, feature gates, latest acceptance outcomes, integration health, Client/Service schema state, and Commission migration state.
- Readiness Board summarizes operational queues and acceptance evidence.
- Audit History surfaces rollout evidence separately from the general event stream.
- Integration Monitor includes active errors, resolution notes, setup references, and a short-term resolved-history view.

## Module status

| Module | Feature gate | Current state |
|---|---:|---|
| Leads | `LEADS_ENABLED` | 18/18 acceptance steps PASS and owner production decision recorded; monitor normal operations and keep external workflow/configuration changes separately controlled |
| GHL appointment relay | uses Lead workflow | Built, guarded against reopening Closed Won, and covered by controlled testing |
| GHL opportunity relay | uses Lead workflow | Code and controlled harness deployed; live external GHL workflow configuration remains owner-controlled |
| GHL inbound reply relay | uses Lead workflow | Code and controlled warm-reply path deployed; live external GHL workflow configuration remains owner-controlled |
| Client Servicing | `SERVICING_ENABLED` | Workflow and production Client/Service schema present; gate remains locked pending separately authorized acceptance |
| Commissions | `COMMISSIONS_ENABLED` | Application workflow and corrected migration staged; production Commission/Payout schema remains unapplied and gate locked |
| Finance | `FINANCE_ENABLED` | Readiness-only boundary; no payout execution or money movement |

## Core business rules

- New imports do not enter Open Pool directly.
- Referral protection begins at entry; Open Pool requires a documented eligible return.
- DNC and suppression immediately block future sales/marketing workflow and cancel scheduled callbacks.
- Lead ownership is retained through appointment, opportunity, and reply attribution unless an authorized reassignment occurs.
- A late GHL Opportunity Lost event cannot reverse a Lead already marked Closed Won.
- Appointment booking, confirmation, or rescheduling cannot reopen a Lead already marked Closed Won.
- GHL replies create or expedite owner work; unassigned replies require manager triage.
- Healthy, current-paying client accounts do not lose servicing ownership for inactivity alone.
- Good-standing agents may retain service responsibility; House transfer requires an authorized reason. Retired/terminated commission policy is handled through the separately gated Commission phase.
- Finance approval, payment clearance, eligibility timing, no hold, and provider readiness are required before any future payout. The CRM never auto-pays.

## Security and compliance guardrails

- Never store SSNs, tax IDs, raw bank/routing details, payment card data, provider credentials, raw signed documents, or tax forms.
- Store only approved external references and status metadata where needed.
- Secrets are server-only environment values.
- Sensitive actions write to `AuditLog`.
- All protected actions authorize server-side; client input is not trusted.
- GHL links, other-client data, confidential wholesale pricing, commission mechanics, scripts, and ICP data are not exposed to agents by default.

## Immediate next sequence

1. Use `/admin/project-readiness` as the source-derived preflight before any module decision.
2. Monitor normal Lead Flow and unresolved Integration Monitor items; keep live external GHL workflow/configuration changes separately controlled.
3. Open a Client Servicing acceptance window only after explicit owner authorization; do not change `SERVICING_ENABLED` as part of ordinary code work.
4. Apply the PR #100 Commission migration only after a new explicit Hamilton authorization and a fresh production-apply plan; migration apply and feature activation must remain separate decisions.
5. Run controlled Commission acceptance only after production schema approval; keep Finance locked and readiness-only.
6. Continue platform hardening separately: preview/production secret isolation, least-privilege database access/RLS decision, structured error tracking, authenticated login smoke coverage, and scaling/backups review.
