# Mercury Call Desk MiniCRM — Working Instructions

## Purpose

Mercury Call Desk is a controlled MiniCRM for lead operations, GHL-backed appointment and outcome relays, client servicing, agent onboarding, commission readiness, and later Finance readiness.

- Production branch: `main`
- Production host: `https://crm.mercurycalldesk.com`
- Database system of record: Neon PostgreSQL
- GHL is a backend integration only. Agents do **not** receive GHL credentials.

Read [docs/WORKSPACE.md](./docs/WORKSPACE.md), [docs/LEAD_MVP_ROLLOUT_STATUS.md](./docs/LEAD_MVP_ROLLOUT_STATUS.md), and [docs/LEAD_MVP_ACCEPTANCE_TEST.md](./docs/LEAD_MVP_ACCEPTANCE_TEST.md) before changing workflow behavior.

## Non-negotiable operating rules

1. Never assume a feature flag is enabled. Verify the deployment/environment state before describing a module as active.
2. Do not run blanket production migrations such as `prisma migrate deploy`. Neon releases use a safety branch, explicit review, and an explicit production apply.
3. Do not store SSNs, EINs, tax documents, banking details, card data, provider credentials, or raw signed documents in the MiniCRM.
4. Do not add payout execution, payment collection, or bank-transfer functionality. Finance remains readiness-only until separately approved.
5. Keep all role and ownership checks server-side. Do not trust browser form data for lead owner, lifecycle, client account linkage, or agent eligibility.
6. Preserve immutable audit evidence for sensitive actions and tests.
7. Use test records only until the owner records acceptance results and deliberately opens a controlled feature-gate window.

## Current workflow boundaries

### Leads

- New imports go to `PENDING_REVIEW`; they never enter Open Pool directly.
- Open Pool is only for documented eligible returns from previously assigned, non-referral Leads with two-way contact.
- DNC and suppression must cancel outstanding callbacks and remove the Lead from active work.
- Wrong number and out-of-business are invalid-contact suppression events.
- Agents can only work their assigned Leads; certification controls claim eligibility.
- A verified inbound reply routes to the existing owner immediately. Unassigned replies go to admin Warm Reply Triage.

### GHL relays

- Appointments: `/api/ghl/appointments`
- Opportunities: `/api/ghl/opportunities`
- Inbound replies: `/api/ghl/replies`

Each relay is authenticated, location-validated, idempotent by GHL event ID, and audited. Do not treat a relay as live until its controlled test is recorded on the Lead acceptance board.

### Closed Won → Client Service

- Only a verified, active, non-suppressed `CLOSED_WON` Lead may create a linked Client Account.
- The service-layer transaction locks and rechecks the source Lead, rejects duplicates, and uses actual GHL/originating-agent context.
- Client launch confirmation is documented; it does not collect payment or create a commission.
- Healthy, current-paying accounts are not reassigned solely because they are quiet.

### Agent onboarding

- Four document statuses are tracked: Sales Agreement, NDA/IP, W-9/entity acknowledgment, and New Hire Acknowledgment.
- The Agent profile supports `companyName` for company/entity W-9 testing. Track only the company/entity name and external document reference; never upload a W-9.
- Lead eligibility requires an active agent, all four documents completed, and a manager-recorded certification decision.

### Commission and Finance

- Commission workspace is review/ledger/eligibility readiness only; no payout execution.
- Finance is readiness-only and must remain separately gated.
- Do not add Commission Hold management until the exact deployed schema/migration is reviewed through an approved source.

## Required documentation updates

When changing a workflow, update the relevant documents in the same change set:

- `README.md` — public project status and next controlled steps.
- `docs/WORKSPACE.md` — implementation inventory, feature gates, and pending work.
- `docs/LEAD_MVP_ROLLOUT_STATUS.md` — Lead and GHL rollout state.
- `docs/LEAD_MVP_ACCEPTANCE_TEST.md` — controlled test requirements.
- `docs/DAILY_LOG.md` and the current `docs/daily-logs/` entry — build activity and verified results.
- `docs/INDEX.md` — add new operational documents.

## Build discipline

- Prefer small, auditable changes.
- Check the deployment status after a commit before calling it production-ready.
- Do not describe a blocked connector action as completed.
- Do not turn test acceptance evidence into automatic feature-gate activation.
