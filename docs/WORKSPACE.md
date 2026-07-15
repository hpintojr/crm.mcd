# Mercury Call Desk MiniCRM — Workspace

**Purpose:** Current operating map for implementation, testing, rollout, and safe handoff.

## Source of truth

| Area | Source |
|---|---|
| Production code | GitHub `main` |
| Production app | `https://crm.mercurycalldesk.com` |
| Current deployed SHA | `/api/status` and `/admin/project-readiness` |
| System of record | Neon PostgreSQL |
| Deployment | Vercel |
| Calendar / opportunity / reply relay source | GoHighLevel (GHL) |
| Admin test evidence | MiniCRM `AuditLog`, acceptance boards, Integration Monitor |
| Cross-module readiness | `/admin/project-readiness` and `/api/admin/project-readiness` |

## Feature-gate rule

Feature flags are independent. Do not assume a flag value from this document; verify the deployed environment before activation or status reporting. A passing acceptance board does not open a feature gate, and a schema apply does not authorize activation.

| Module | Gate | Build/schema state | Activation rule |
|---|---|---|---|
| Leads | `LEADS_ENABLED` | Core workflow deployed; 18/18 production acceptance steps and owner decision recorded PASS | Normal Lead Flow approved; keep live external GHL configuration and new import/export runs separately controlled |
| Servicing | `SERVICING_ENABLED` | Workflow built; Client/Service raw-SQL tables present in production | Controlled Servicing acceptance only after a separate owner-authorized window |
| Commissions | `COMMISSIONS_ENABLED` | Workflow built; PR #100 migration corrected and safety-branch-tested; Commission/Payout tables remain unapplied in production | Production migration apply requires new explicit authorization; acceptance and feature activation remain separate later decisions |
| Finance | `FINANCE_ENABLED` | Readiness-only boundary; optional Stripe Connect destination policy staged | No money movement, payment-provider execution, payout release, or Connect account/transfer action |

## Implemented workflow map

### 1. Agent onboarding and certification

- Admin document tracker records status for Sales Agreement, NDA/IP, W-9/entity acknowledgment, and New Hire Acknowledgment.
- `Agent.companyName` is used for company/entity W-9 test coverage. The MiniCRM stores only the name and external-reference/status metadata; never the tax form or tax identifiers.
- Internal activation gates (W-9 secure-intake verification, profile completeness, CRM training/check-in) are recorded by an admin with a note and audit evidence; provisioning requires all three plus completed, countersigned documents. The activation state is derived by `src/lib/agent-activation-policy.ts`, never stored. Previously provisioned agents are grandfathered.
- Certification requires an active agent, all four documents completed, a manager decision, and audit evidence.
- Training workspace shows the agent their document count, certification outcome, and Lead eligibility state.

### 2. Lead lifecycle

`RAW/PENDING_REVIEW → AVAILABLE → CONTACTED/NURTURING → CLAIMED → DEMO_BOOKED → CLOSED_WON or CLOSED_LOST`

- Signed batch import and controlled JSON/CSV conversion require server preview before commit.
- Required import values are company, usable business phone, original source, and intake method.
- Admin review approves only managed pools. New imports cannot enter Open Pool.
- Cold Leads are worked activity-first: call attempts log `CALL_INITIATED` before the device dialer opens and do not soft-lock, reserve, or claim the record.
- No-answer and voicemail dispositions keep the Lead unowned and available in Cold Leads.
- Callback-requested, qualified, and follow-up/interested dispositions record two-way contact and unlock claim eligibility without auto-claiming.
- Claiming is atomic and agent-scoped; claiming requires `twoWayContactAt` and starts the 45-day responsibility timer.
- My Workspace shows assigned records, callback queue, recent activity, and claim-timer responsibility without requiring a selected Lead ID.
- The secured daily aging sweep returns expired claimed Leads to Open Pool and promotes 21-day stale unclaimed Open Pool records to Shark Tank.
- Notes, dispositions, callbacks, two-way contact, wrong-number/out-of-business, DNC, and suppression are audited.
- Admin suppression cancels scheduled callbacks and clears future action state.
- Warm reply triage assigns an unowned verified reply to one active agent atomically and creates immediate callback work.
- The full 18-step production Lead Flow acceptance runbook and owner production decision are recorded PASS.

### 3. GHL → MiniCRM relays

| Relay | Endpoint | Current behavior | Remaining control |
|---|---|---|---|
| Appointment lifecycle | `/api/ghl/appointments` | Booked/Confirmed/Rescheduled maintain `DEMO_BOOKED`; Cancelled/No-show create same-owner follow-up; any appointment event preserves an existing `CLOSED_WON` | Live external workflow changes remain owner-controlled |
| Opportunity result | `/api/ghl/opportunities` | Won → `CLOSED_WON`; Lost → `CLOSED_LOST`; late loss cannot undo Closed Won; suppressed Leads unchanged | Live external workflow changes remain owner-controlled |
| Inbound reply | `/api/ghl/replies` | Logs inbound SMS/email, records two-way contact, creates or expedites owner callback; unowned reply goes to Warm Reply Triage; DNC/suppressed Leads unchanged | Live external workflow changes remain owner-controlled |

All three use verified webhook handling, approved location validation, idempotency by GHL event ID, and audit/integration-error records. Controlled test tooling exists for relay and warm-reply acceptance without calling live GHL.

### 4. Closed Won → Client Servicing

1. GHL Opportunity Won or an admin’s verified Closed Won decision marks a Lead `CLOSED_WON`.
2. Admin uses the Client Onboarding Queue.
3. Service layer locks and rechecks the source Lead inside the transaction:
   - must be `CLOSED_WON`
   - must not be DNC/suppressed
   - may not already have a Client Account
   - originating agent and GHL contact are sourced from the live Lead record
4. Admin confirms launch as Current on Payments or Payment Issue.
5. Triggered service work creates a Service Case; response and resolution are documented.
6. Healthy, current-paying accounts remain with their owner when quiet. House transfer requires a reason and audit record.

The Client/Service schema is already present in production. Normal Servicing use remains feature-gated and requires a separately authorized controlled acceptance window.

### 5. Commission eligibility and ledger

- Commission review uses raw SQL behind `COMMISSIONS_ENABLED`.
- Source code includes agent Commission profiles, eligibility decisions, ledger intake/review, hold application/release, retirement/termination policy, and audit evidence.
- PR #100 corrected the staged migration to define the exact app-used enums and fields plus `CommissionHold`, `CommissionEligibilityDecision`, and `AgentCommissionProfile`; existing payout reference tables remain in the same staged migration.
- The exact final DDL passed disposable Neon catalog verification and an app-style lifecycle smoke test.
- The Commission/Payout tables and enums remain absent from production. The migration has not been applied.
- Applying the migration, enabling Commissions, and running controlled Commission acceptance are three separate owner decisions.

### 6. Finance boundary

- Finance is readiness-only.
- It documents prerequisites: eligible Commission entry, payment clearance, no active hold, documented approval, and an externally verified destination reference.
- The CRM does not store raw bank/routing data, execute payment-provider actions, release payouts, or move money.

## Project readiness control plane

`/admin/project-readiness` is the protected, source-derived preflight for cross-module decisions. It reads:

- Vercel deployment environment, branch, commit, and deployment ID;
- current feature-gate values;
- latest Lead, Servicing, and Commission acceptance outcomes;
- unresolved Integration Errors and failed Webhook Events;
- production Client/Service table presence;
- expected Commission/Payout table and enum presence;
- exact Commission enum ordering;
- legacy Commission enum and ledger-column drift indicators.

The matching JSON endpoint is `/api/admin/project-readiness`. Both are read-only and use `Cache-Control: no-store`.

## What is not complete or intentionally paused

- Full browser-level `tel:` interception is not implemented; the Cold Lead path uses activity-first API logging followed by a device dial link.
- Live external GHL workflow/configuration changes remain owner-controlled even though relay code and controlled harness tests are deployed.
- Automatic GHL Opportunity Won → Client Account creation remains intentionally disabled.
- Servicing acceptance and normal feature activation remain gated.
- Commission production schema apply remains gated; production currently has no Commission/Payout tables from PR #100.
- Commission acceptance remains gated until after an approved production schema apply.
- Finance/payment provider execution, bank data, payment collection, and payouts are not implemented.
- External email/SMS campaign sending is not part of the inbound-reply relay.
- Preview and production environment isolation, least-privilege database role/RLS, structured error tracking, authenticated login smoke automation, and scaling/backups policy remain platform-hardening work.

## Current next sequence

1. Use `/admin/project-readiness` before any release or module decision.
2. Continue monitoring normal Lead Flow, Integration Monitor, aging, and deployment guard results.
3. Make live GHL workflow/configuration changes only through a separately approved controlled plan.
4. Open Client Servicing acceptance only after explicit owner authorization; keep the feature gate independent from code changes.
5. Apply PR #100’s Commission migration only through a fresh owner-authorized production-apply plan; verify catalog state afterward before considering Commission acceptance.
6. Keep Finance readiness-only until Commission schema and acceptance stabilize and a separate owner decision is recorded.
7. Address platform hardening as separate reviewed work: preview/prod secret isolation, database least privilege/RLS, observability, authenticated E2E login smoke, Neon scaling, and backup retention.

## Operational pages

| Purpose | Path |
|---|---|
| Project readiness control plane | `/admin/project-readiness` |
| Project readiness JSON | `/api/admin/project-readiness` |
| Main admin command center | `/admin/command-center` |
| Module operating status | `/admin/operating-status` |
| Feature-gate display | `/admin/settings` |
| Lead review / controlled import | `/admin/leads` |
| Lead acceptance evidence | `/admin/leads/testing` |
| Lead acceptance overview | `/admin/leads/acceptance-overview` |
| Lead deployment verification | `/admin/leads/deployment-verification` |
| Agent Cold Lead / active Lead workspace | `/portal/leads` |
| My assigned-work dashboard | `/portal/workspace` |
| Lead aging cron | `/api/cron/leads/aging` |
| Warm Reply Triage | `/admin/leads/replies` |
| Demo-booked GHL handoff | `/admin/leads/handoff` |
| Open Pool return controls | `/admin/leads/release` |
| Agent documents | `/admin/agents/:id/onboarding` |
| Agent certification | `/admin/agents/:id/certify` |
| Client onboarding queue | `/admin/servicing/onboarding` |
| Launch confirmations | `/admin/servicing/launches` |
| Service cases | `/admin/servicing/cases` |
| Servicing acceptance | `/admin/servicing/testing` |
| Commission eligibility | `/admin/commissions` |
| Commission acceptance | `/admin/commissions/testing` |
| Finance readiness | `/admin/finance` |
| Integration Monitor | `/admin/integrations` |
| Controlled GHL event harness | `/admin/integrations/test-events` |
| Resolved integration history | `/admin/integrations/resolved` |
| Readiness Board | `/admin/readiness` |
| Audit history | `/admin/audit` |
