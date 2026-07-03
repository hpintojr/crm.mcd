# Mercury Call Desk — V1 Rebuild Specification

## Status

- **Rebuild branch:** `rebuild/v1-foundation`
- **Baseline commit:** `92c052a99c3d0375ca178abc589ee90d38d033bf`
- **Baseline Preview:** `recovery/e59-route-fix`
- **Production, `main`, migrations, and production Neon data:** frozen during rebuild.

## Product Purpose

Mercury Call Desk is the internal operating system for Mercury Call Desk’s AI telephony business. It manages lead intake, agent access, controlled sales progression, client onboarding, servicing activity, compliance records, and commission visibility.

The system is not a lender, payment processor, or replacement for GoHighLevel. GoHighLevel remains the downstream communications/calendar/invoice system when a lead reaches the approved handoff point.

## Non-Negotiable Build Rules

1. Every feature is built on its own short-lived branch from the working rebuild branch.
2. Every branch must have a Vercel Preview deployment before it can be reviewed.
3. No code reaches `main` or production without an explicit preview acceptance result.
4. Preview must not write to production customer data. A separate Neon preview branch and Preview-only `DATABASE_URL` are required before any test workflow writes data.
5. Authentication is frozen at the known-good baseline until a dedicated auth release is separately specified and tested.
6. No duplicate Next.js dynamic path segments may exist at the same route level.
7. Every state-changing action needs authorization, validation, an audit record, and an idempotent retry-safe design where applicable.
8. No external GoHighLevel action is allowed from Preview unless it uses a dedicated test location and test credentials.

## Roles and Access

### Owner

- Full administrative access.
- Can manage users, agent status, compliance, readiness, lead assignment, close verification, servicing, commissions, and audit records.

### Administrative roles

- `SUPER_ADMIN`, `SALES_MANAGER`, `COMPLIANCE_MANAGER`, and `FINANCE_MANAGER` receive only the screens and actions needed for their assigned function.
- Administrative access must be enforced on the server, not only hidden in the interface.

### Agent

- Can see only their own assigned leads, permitted Open Pool opportunities, personal activity, permitted tasks, and allowed servicing records.
- Cannot view other agents’ private lead records, commissions, or administrative controls.
- Cannot mark a lead Closed Won without the approved administrative verification flow.

## Core Lead Model and Workflow

### Intake

A lead can originate from:

- Website
- Referral
- Paid lead file
- Manual entry
- Imported list
- Campaign or partner source

The original source, campaign, referral, and attribution fields remain attached to the lead throughout its lifecycle.

### Availability and ownership

- Unassigned eligible leads enter the Open Pool.
- An agent can claim an eligible lead through a server-authorized, atomic action.
- Claim, release, reassignment, and ownership changes create auditable events.
- DNC or suppressed records cannot enter the active agent workflow.

### Lifecycle

The V1 lifecycle is:

1. `NEW`
2. `OPEN_POOL`
3. `CLAIMED` / active agent ownership
4. `CONTACTED`
5. `DEMO_BOOKED`
6. `CLOSED_WON`
7. `CLOSED_LOST` or `DISQUALIFIED`

DNC and suppression are compliance states that override normal selling activity.

### Demo and GHL handoff

- A lead is eligible for downstream GoHighLevel handoff only at `DEMO_BOOKED`.
- Handoff must be explicit, auditable, idempotent, and visible in the lead history.
- The Mini CRM remains the operational source of truth for lead ownership and sales status.

### Verified Closed Won

- Only approved administrative roles may move a lead from `DEMO_BOOKED` to `CLOSED_WON`.
- The lead must not be DNC or suppressed.
- A verification note is required.
- The action must create:
  - lifecycle update
  - lead note
  - `LEAD_CLOSED_WON_VERIFIED` audit event
  - visible onboarding eligibility
- Recording Closed Won does not itself create a client account, invoice, commission, payment, or payout.

## Servicing and Onboarding

### Client onboarding

- A verified Closed Won lead becomes eligible for controlled client onboarding.
- Onboarding must be separately tracked from the sales lifecycle.
- Onboarding records must preserve responsible user, required documents/status, timestamps, issues, and next action.

### Healthy accounts

- A client who is current on payment and has no issues does not require routine quarterly contact merely to preserve assignment or commissions.
- Servicing performance is evaluated through account activity and triggered-response performance: client requests, support issues, payment problems, renewals, escalations, and documented resolutions.
- Lack of activity on a healthy paying account is not by itself a reason to reassign the account or remove commissions.

## Commission Policy Rules

- Agents leaving on good terms may continue receiving commissions when they continue servicing their clients.
- If an agent does not want to service their clients, the accounts move to the House Account.
- Retired agents continue collecting commissions under the applicable agreement.
- Agents who are fired lose future commission rights and their accounts move to the House Account.
- Commission calculation and payouts remain read-only or manually approved until their own dedicated release.

## Compliance and Audit

Every protected workflow must record enough information to explain:

- who performed the action
- the user role at the time
- the target lead/client/account
- the prior and resulting state where relevant
- the timestamp
- the reason or evidence provided

Compliance states include DNC and suppression. These states block prohibited selling actions and must remain visible to authorized users.

## V1 Delivery Sequence

### Milestone 0 — Stable foundation

- Preserve the working login behavior exactly.
- Confirm public routes, admin routes, and agent portal routes load in Preview.
- Remove all experimental auth and route-debug changes from the rebuild path.
- Establish a dedicated Neon Preview branch before any data-changing Preview test.

**Acceptance:** fresh Preview can load the landing page, sign in with MFA, route an owner to Admin, route an agent to Portal, and load one protected page for each role.

### Milestone 1 — Admin and agent shell

- Role-aware navigation
- Admin dashboard shell
- Agent portal shell
- Server-side authorization checks
- Empty/loading/error states

**Acceptance:** each role sees only its permitted navigation and direct URL access is denied where not authorized.

### Milestone 2 — Lead intake, Open Pool, and ownership

- Lead list and detail screens
- Intake/import validation
- Open Pool availability
- Atomic claim, release, and reassignment
- Lead activity and notes
- DNC/suppression restrictions

**Acceptance:** agents cannot access another agent’s lead; all ownership changes appear in audit history; invalid state actions are blocked.

### Milestone 3 — Demo and verified sales progression

- Demo-booked workflow
- GHL handoff status
- Verified Closed Won control
- Onboarding eligibility

**Acceptance:** only valid Demo Booked, non-suppressed leads can become Closed Won; the action creates the required note and audit event exactly once.

### Milestone 4 — Onboarding and servicing

- Client account onboarding queue
- Account status, cases, tasks, launch records, and payment issue tracking
- Triggered servicing activity tracking

**Acceptance:** healthy accounts are not penalized for inactivity; issue-based work is recorded and assigned correctly.

### Milestone 5 — Commissions, finance, and audit reporting

- Read-only commission ledger and account attribution views
- House Account transfer visibility
- Audit search/export

**Acceptance:** role restrictions work, records are traceable, and no payout action exists without its own approval flow.

### Milestone 6 — Integration hardening

- Dedicated test environment configuration
- Idempotency keys and retry behavior
- Webhook signature validation
- Failed-event queue and operator visibility

**Acceptance:** repeated webhooks do not duplicate records or actions; test integrations cannot send to production recipients.

## Preview Acceptance Checklist

Before any merge candidate is considered:

1. Vercel Preview is `READY`.
2. Fresh browser session can load public pages.
3. Login and MFA are tested using the role intended for the feature.
4. Admin and Portal protected-route behavior is confirmed.
5. Vercel runtime logs show no unhandled errors for the tested path.
6. No unexpected database or third-party writes occurred.
7. The change list matches the milestone scope and contains no unrelated auth, dependency, migration, or configuration change.
8. A rollback commit or known-good deployment is identified.

## Explicitly Out of Scope Until Later Approval

- Production deployment
- Production database migrations
- Automatic commissions or payouts
- Production GoHighLevel sends, appointments, invoices, or financial actions
- Bulk contact campaigns
- New authentication architecture or dependency upgrades
