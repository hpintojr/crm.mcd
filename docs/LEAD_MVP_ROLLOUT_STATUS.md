# Lead MVP Rollout Status

**Status:** Built for controlled acceptance testing. Do not treat the Lead module or any relay as normally active until the deployed gate state and owner-recorded acceptance evidence are verified.  
**Last updated:** July 2, 2026

## What is complete

### Lead workflow

- Production Lead schema supports ownership, claim events, activities, notes, callbacks, suppression, source tracking, campaigns/UTMs, appointment references, GHL contact/opportunity references, and two-way contact.
- Controlled import supports JSON and CSV conversion into the existing preview-before-commit pipeline.
- Valid imported rows begin in `PENDING_REVIEW`; new imports never enter Open Pool directly.
- Admin review supports managed-pool approval, documented disqualification, and compliance suppression.
- Admin suppression cancels scheduled callbacks, clears future-action state, writes suppression/activity/audit history, and removes active-work access.
- Agent workspace supports atomic claim, owner-only work, notes, dispositions, callbacks, DNC, wrong number, and out-of-business outcomes.
- Open Pool returns are restricted to documented, previously assigned, non-referral, non-suppressed Leads with two-way contact and an eligible lifecycle.
- Admin Lead detail supports an auditable Verified Closed Won decision.

### Agent readiness

- Document tracking exists for Sales Agreement, NDA/IP, W-9/entity acknowledgment, and New Hire Acknowledgment.
- The Agent profile supports a Company / Entity Name for entity W-9 test coverage. The MiniCRM stores only profile/status/reference metadata—not forms or tax identifiers.
- Certification records manager decision, scores, and audit evidence. Lead eligibility requires active status, all four document completions, and approved certification.

### GHL appointment relay

- `POST /api/ghl/appointments` is verified, location-validated, idempotent, and monitored.
- Time parsing was hardened for GHL machine values and human-readable formats encountered during testing.
- Booked, Confirmed, and Rescheduled maintain `DEMO_BOOKED` and preserve ownership.
- Cancelled and No-show create or expedite same-owner follow-up work.
- Schedule and Inbox surfaces show appointment outcome checks rather than silently dropping historic events.
- Controlled appointment testing has been performed for Rescheduled, No-show, and Completed. Continue the full state test during acceptance.

### GHL opportunity relay

- `POST /api/ghl/opportunities` is implemented with verification, idempotency, and audit logging.
- `OPPORTUNITY_WON` moves a matched active Lead to `CLOSED_WON`.
- `OPPORTUNITY_LOST` moves an open matched Lead to `CLOSED_LOST`.
- Matching prefers MiniCRM Lead ID, then stored GHL opportunity/contact data.
- Suppressed/DNC Leads remain unchanged.
- A late Lost event cannot reverse an already Closed Won Lead.
- **Pending:** external GHL workflow configuration and controlled acceptance test.

### GHL inbound reply relay

- `POST /api/ghl/replies` is implemented with verification, idempotency, matching, activity/note history, and audit logging.
- Matching prefers MiniCRM Lead ID, then GHL contact ID, email, and phone.
- A matched owned Lead receives immediate callback work or an existing future callback is expedited.
- An unowned active reply appears in Warm Reply Triage for an authorized manager assignment.
- DNC/suppressed Leads remain unchanged.
- **Pending:** external GHL workflow configuration and controlled acceptance test.

### Closed Won to Client Servicing boundary

- Client onboarding begins in `/admin/servicing/onboarding`, not from a generic servicing form.
- A linked Client Account can only be created from a live verified `CLOSED_WON` Lead that is not DNC/suppressed and has no existing Client Account.
- The creation service locks and rechecks the source Lead inside its transaction and sources GHL/originating-agent context from the actual Lead record.
- This is intentionally separate from automatic GHL Opportunity Won → Client Account creation.

## Current rollout state

| Area | State |
|---|---|
| Lead application workflow | Built for controlled test |
| Lead production database schema | Applied and used by deployed workflow |
| Lead activation | Requires explicit verification of `LEADS_ENABLED` and owner-controlled test window |
| Appointment relay | Built and partially exercised; complete full acceptance sequence before sign-off |
| Opportunity relay | Built; external GHL setup/test pending |
| Inbound reply relay | Built; external GHL setup/test pending |
| Client Servicing workflow | Built behind separate gate; do not activate from Lead test alone |
| Commission and Finance | Separate gated phases; no payout execution |

## Deliberately not enabled or started

- Do not assume any feature gate is enabled without verifying the deployed Vercel environment.
- No automatic GHL Opportunity Won → Client Account creation.
- No external email/SMS campaign sending from the inbound reply relay.
- No Commission Hold management until the exact deployed schema is inspected through an approved path.
- No Finance execution, payment collection, provider instruction, or payout automation.
- No storage of tax forms, tax IDs, banking information, or provider credentials.

## Required acceptance gate

Execute [Lead MVP Acceptance Test](./LEAD_MVP_ACCEPTANCE_TEST.md) using internal test records only.

The current test-agent plan is:

1. **Individual test agent:** active, four documents complete, certified, eligible to test valid claims.
2. **Company/entity test agent:** active, Company / Entity Name tracked in Documents, W-9/entity acknowledgment tracked without storing a document, initially not certified to test claim denial.

Record Pass, Fail, or Deferred evidence in `/admin/leads/testing`. A recorded pass does not enable a feature gate automatically.

## Next phase after Lead acceptance

Run the Client Servicing acceptance path:

1. Verified Closed Won Lead → Client Onboarding Queue.
2. Create Client Account with package/owner selection.
3. Document launch state.
4. Create triggered Service Case, record response, resolve case.
5. Confirm a healthy, current-paying quiet account is not reassigned.
6. Confirm retained servicing and authorized House transfer behavior.

Keep Commission and Finance independently gated after Servicing acceptance until their schema and policy work is separately approved.
