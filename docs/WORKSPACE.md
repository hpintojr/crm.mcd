# Mercury Call Desk MiniCRM — Workspace

**Purpose:** Current operating map for implementation, testing, rollout, and safe handoff.

## Source of truth

| Area | Source |
|---|---|
| Production code | GitHub `main` |
| Production app | `https://crm.mercurycalldesk.com` |
| System of record | Neon PostgreSQL |
| Deployment | Vercel |
| Calendar / opportunity / reply relay source | GoHighLevel (GHL) |
| Admin test evidence | MiniCRM `AuditLog`, acceptance boards, Integration Monitor |

## Feature-gate rule

Feature flags are independent. Do not assume a flag value from this document; verify the deployed environment before activation or status reporting.

| Module | Gate | Build state | Activation rule |
|---|---|---|---|
| Leads | `LEADS_ENABLED` | Controlled lead import, review, Cold Lead activity-first workspace, two-way-contact claim gate, DNC, warm replies, GHL relays, acceptance board | Controlled test window only after owner approval |
| Servicing | `SERVICING_ENABLED` | Closed Won onboarding, client account guard, launch, cases, ownership/House controls, acceptance board | Controlled servicing test after Lead lifecycle is proven |
| Commissions | `COMMISSIONS_ENABLED` | Eligibility/readiness/ledger review and acceptance board; Hold management intentionally paused pending schema confirmation | Do not enable until migration and policy tests are approved |
| Finance | `FINANCE_ENABLED` | Readiness-only boundary page | No money movement or payout execution |

## Implemented workflow map

### 1. Agent onboarding and certification

- Admin document tracker records status for Sales Agreement, NDA/IP, W-9/entity acknowledgment, and New Hire Acknowledgment.
- `Agent.companyName` is used for company/entity W-9 test coverage. The MiniCRM stores only the name and external-reference/status metadata; never the tax form or tax identifiers.
- Certification requires an active agent, all four documents completed, a manager decision, and audit evidence.
- Training workspace shows the agent their document count, certification outcome, and Lead eligibility state.

### 2. Lead lifecycle

`RAW/PENDING_REVIEW → AVAILABLE → CONTACTED/NURTURING → CLAIMED → DEMO_BOOKED → CLOSED_WON or CLOSED_LOST`

- Imports support controlled JSON and CSV conversion, but server preview is required before commit.
- Required import values are company, usable business phone, original source, and intake method. CSV headers will be mapped after the test-file headers are reviewed.
- Admin review approves only managed pools. New imports cannot enter Open Pool.
- Cold Leads are worked activity-first: call attempts log `CALL_INITIATED` only and do not soft-lock, reserve, or claim the record.
- No-answer and voicemail dispositions keep the Lead unowned and available in Cold Leads.
- Callback-requested, qualified, and follow-up/interested dispositions record two-way contact and unlock claim eligibility without auto-claiming.
- Claiming is atomic and agent-scoped; claiming requires `twoWayContactAt` and starts the 45-day responsibility timer.
- Notes, dispositions, callbacks, two-way contact, wrong-number/out-of-business, DNC, and suppression are audited.
- Admin suppression cancels scheduled callbacks and clears future action state.
- Warm reply triage assigns an unowned reply to one active agent atomically and creates immediate callback work.

### 3. GHL → MiniCRM relays

| Relay | Endpoint | Current behavior | Test requirement |
|---|---|---|---|
| Appointment lifecycle | `/api/ghl/appointments` | Booked/Confirmed/Rescheduled maintain `DEMO_BOOKED`; Cancelled/No-show create same-owner follow-up; schedule retains recent outcomes | Controlled event test across all appointment states |
| Opportunity result | `/api/ghl/opportunities` | Won → `CLOSED_WON`; Lost → `CLOSED_LOST`; late loss cannot undo Closed Won; suppressed Leads unchanged | Configure GHL workflow and test Won, Lost, retry, late loss, suppression |
| Inbound reply | `/api/ghl/replies` | Logs inbound SMS/email, records two-way contact, creates or expedites owner callback; unowned reply goes to Warm Reply Triage; DNC/suppressed Leads unchanged | Configure GHL workflow and test owned, unowned, duplicate event, suppression |

All three use verified webhook handling, approved location validation, idempotency by GHL event ID, and audit/integration-error records.

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

## What is not complete or intentionally paused

- Full client-side `tel:` interception is not complete; the current Cold Lead branch uses a dial link plus explicit call-start logging.
- Open Pool expiration and Shark Tank promotion background jobs are not complete in the current Lead branch.
- GHL Opportunity and Inbound Reply workflows still require external GHL configuration and controlled acceptance testing.
- Automatic GHL Opportunity Won → Client Account creation remains intentionally disabled.
- Client-account production migration protections are prepared but not yet approved/applied as a production database release.
- Commission Hold management is not built because the exact deployed Hold schema was not available through an approved inspection path.
- Commission production schema rollout remains on an isolated Neon safety branch; no production Commission schema apply is assumed.
- Finance/payment provider execution, bank data, payment collection, and payouts are not implemented.
- External email/SMS campaign sending is not part of the inbound-reply relay.

## Current controlled test plan

### Test agents

1. **Agent A — individual test agent**
   - Active
   - All four onboarding documents complete
   - Certified/eligible for Lead claim test

2. **Agent B — company/entity W-9 test agent**
   - Active
   - Company/entity name recorded in Documents → W-9/entity section
   - W-9 acknowledgment status tracked without storing a W-9
   - Leave uncertified initially to prove claim access is blocked

### Test CSV

Before import, review the actual source headers and map them to the controlled import model. Minimum viable columns:

```text
company
businessPhone
originalSource
intakeMethod
```

Useful optional columns include contact names, email, website, industry, city, state, timezone, campaign data, referral data, and UTM values.

### Test order

1. Confirm feature gates and deployment state.
2. Create/configure the second test agent and record company/entity W-9 status.
3. Validate CSV header mapping and use a small internal-only batch.
4. Execute Lead acceptance steps: import, review, Cold Lead activity, no-claim-before-contact boundary, DNC, claim after two-way contact, Open Pool return, GHL appointments, opportunity results, and inbound replies.
5. Record Pass/Fail/Deferred evidence on `/admin/leads/testing`.
6. Run servicing acceptance only after the Lead lifecycle test is signed off.
7. Keep Commissions and Finance gated.

## Operational pages

| Purpose | Path |
|---|---|
| Lead review / controlled import | `/admin/leads` |
| Lead acceptance evidence | `/admin/leads/testing` |
| Agent Cold Lead / active Lead workspace | `/portal/leads` |
| Warm Reply Triage | `/admin/leads/replies` |
| Demo-booked GHL handoff | `/admin/leads/handoff` |
| Open Pool return controls | `/admin/leads/release` |
| Agent documents | `/admin/agents/:id/onboarding` |
| Agent certification | `/admin/agents/:id/certify` |
| Client onboarding queue | `/admin/servicing/onboarding` |
| Launch confirmations | `/admin/servicing/launches` |
| Service cases | `/admin/servicing/cases` |
| Integration Monitor | `/admin/integrations` |
| Reply relay setup | `/admin/integrations/replies` |
| Opportunity relay setup | `/admin/integrations/opportunities` |
| Resolved integration history | `/admin/integrations/resolved` |
| Readiness Board | `/admin/readiness` |
| Audit history | `/admin/audit` |
