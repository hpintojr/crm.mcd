# Mercury Call Desk — Mini CRM (`crm.mcd`)

Secure Admin and Agent portals for Mercury Call Desk. GoHighLevel (GHL) is a backend integration only; agents never receive GHL credentials. Neon PostgreSQL is the system of record, and GitHub `main` deploys to Vercel production.

## Start here

- [Workspace](./docs/WORKSPACE.md) — current implementation inventory, gates, operational paths, and test plan.
- [Lead MVP Rollout Status](./docs/LEAD_MVP_ROLLOUT_STATUS.md) — Lead, GHL relay, and servicing handoff status.
- [Lead MVP Acceptance Test](./docs/LEAD_MVP_ACCEPTANCE_TEST.md) — owner-controlled test sequence.
- [Documentation Index](./docs/INDEX.md)
- [Working Instructions](./CLAUDE.md)

## Production workflow

- `main` is the production source branch.
- Vercel deploys changes from `main` to `https://crm.mercurycalldesk.com`.
- Production environment values live in Vercel only; never commit credentials.
- Neon schema changes use a safety-branch review before an explicit production apply.
- Do not enable a database-backed feature until its schema, production build, and controlled live test are complete.
- Do not run a blanket `prisma migrate deploy` against production.
- Do not assume a feature-gate value from documentation; verify the deployed environment before activating or describing a module as live.

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

- Controlled JSON/CSV import conversion with server-side preview-before-commit.
- Admin review, duplicate/suppression screening, source/intake validation, and no direct new-import path into Open Pool.
- Atomic claim controls, agent ownership boundaries, notes, dispositions, callbacks, two-way contact, and audit history.
- Immediate DNC and admin suppression protections that cancel scheduled callbacks and remove active-work access.
- Wrong-number and out-of-business invalid-contact suppression.
- Open Pool return protections requiring documented prior ownership, two-way contact, non-referral status, eligible lifecycle, and admin reason.
- Lead detail view with an admin-only verified Closed Won decision.
- Warm Reply Triage for unassigned verified inbound replies, with atomic manager assignment and immediate callback creation.

### GHL relays

- Appointment lifecycle relay at `/api/ghl/appointments`.
- Opportunity result relay at `/api/ghl/opportunities`.
- Inbound SMS/email reply relay at `/api/ghl/replies`.
- All relay paths use verified webhook handling, location allowlisting, event-ID idempotency, audit events, and Integration Monitor errors.
- Appointment time parsing has been hardened for GHL date formats and timezone handling.
- Opportunity and reply relay code is deployed, but each still requires external GHL workflow configuration and controlled acceptance evidence before normal use.

### Client Servicing

- Closed Won onboarding queue, client account creation guard, launch confirmations, account detail, service-case queue, response/resolution controls, and owner/House transfer controls.
- Linked Client Accounts can only be created from active, verified, non-suppressed `CLOSED_WON` Leads; duplicate links are rejected under a transaction lock.
- Healthy, current-paying accounts are not reassigned merely because they are quiet.
- Service cases are trigger-based: client request, support issue, payment problem, renewal event, escalation, or documented review.

### Acceptance, readiness, and audit

- Lead, Servicing, and Commission acceptance boards record Pass, Fail, or Deferred evidence with admin identity, note, and timestamp.
- Readiness Board summarizes current acceptance evidence and operational queues.
- Audit History surfaces rollout evidence separately from the general event stream.
- Integration Monitor includes active errors, resolution notes, setup references, and a short-term resolved-history view.

## Module status

| Module | Feature gate | Current state |
|---|---:|---|
| Leads | `LEADS_ENABLED` | Built for controlled testing; activation requires owner-approved test window and evidence |
| GHL appointment relay | uses Lead workflow | Built and previously exercised in controlled testing; continue monitoring through Integration Monitor |
| GHL opportunity relay | uses Lead workflow | Code deployed; GHL workflow configuration and controlled test remain pending |
| GHL inbound reply relay | uses Lead workflow | Code deployed; GHL workflow configuration and controlled test remain pending |
| Client Servicing | `SERVICING_ENABLED` | Workflow built; validate after Lead lifecycle acceptance |
| Commissions | `COMMISSIONS_ENABLED` | Eligibility/readiness workflow staged; Hold management paused pending schema confirmation |
| Finance | `FINANCE_ENABLED` | Readiness-only boundary; no payout execution or money movement |

## Core business rules

- New imports do not enter Open Pool directly.
- Referral protection begins at entry; Open Pool requires a documented eligible return.
- DNC and suppression immediately block future sales/marketing workflow and cancel scheduled callbacks.
- Lead ownership is retained through appointment, opportunity, and reply attribution unless an authorized reassignment occurs.
- A late GHL Opportunity Lost event cannot reverse a Lead already marked Closed Won.
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

1. Use the existing individual test agent as the active, document-complete, certified agent.
2. Create a second active company/entity test agent; record the Company / Entity Name in its Documents page and leave it uncertified initially for the denial test.
3. Review the actual CSV headers and map them to the controlled import model.
4. Run a small internal-only Lead acceptance batch through import, review, claim, callback, DNC, Open Pool, appointment, opportunity, and reply-relay checks.
5. Record Pass/Fail/Deferred evidence at `/admin/leads/testing`.
6. Run the Servicing acceptance board only after Lead lifecycle acceptance is signed off.
7. Keep Commission and Finance gated until their separate schema/policy readiness work is approved.
