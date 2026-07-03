# Lead MVP Acceptance Test

**Purpose:** Verify Lead operations and GHL handoffs before normal Lead access is enabled.  
**Rule:** Use internal test records only. Label every test company `TEST —`. Do not assume feature-gate values; verify the deployed environment before the test window.

Record each step as **Pass**, **Fail**, or **Deferred** with evidence in `/admin/leads/testing`. Recording evidence never activates a feature gate automatically.

## 1. Controlled test setup

- [ ] Confirm the current Vercel deployment is `READY`.
- [ ] Confirm the current deployed state of `LEADS_ENABLED`; keep it closed until the supervised test window begins.
- [ ] Confirm Servicing, Commissions, and Finance are not being opened as part of this Lead test.
- [ ] Confirm GHL webhook authentication and location allowlist are configured without exposing values in the CRM or test notes.
- [ ] Confirm all test contact details are internal/non-customer data.

### Required test agents

| Agent | Initial state | Test purpose |
|---|---|---|
| Agent A — individual | Active, all four documents complete, certified | Allowed claim and normal agent-work path |
| Agent B — company/entity | Active, Company / Entity Name recorded, W-9/entity acknowledgment tracked, initially not certified | Prove blocked claim path and company/entity onboarding display |

- [ ] Confirm Agent B cannot claim a Lead while uncertified.
- [ ] After that denial is recorded, complete/certify Agent B temporarily only if needed for the simultaneous claim-race test; record the certification decision and later return the test state as desired.

**Pass condition:** Agent eligibility is controlled by documented onboarding and certification, not by a browser-only setting.

## 2. CSV header review and controlled import

Before importing, review the actual CSV headers and map them to the MiniCRM import model.

Minimum expected values per valid row:

```text
company
businessPhone
originalSource
intakeMethod
```

Useful optional values: contact first/last name, email, website, industry, city, state, country, timezone, campaign, referral fields, and UTM fields.

- [ ] Upload the CSV through Admin → Lead Review.
- [ ] Confirm the CSV converts to the existing JSON batch preview.
- [ ] Confirm Preview is required before Commit.
- [ ] Confirm the initial batch is small and internal-only.
- [ ] Confirm valid rows are created as `PENDING_REVIEW` only.
- [ ] Confirm the batch includes or separately tests: valid row, in-batch duplicate, existing duplicate, suppression match, rejected Maps scrape policy row, and referral row.

**Pass condition:** Only valid, non-suppressed, non-duplicate rows are created, and no record reaches an agent workspace before admin review.

## 3. Admin review and pool protection

- [ ] Approve a valid pending record to an allowed managed pool such as Cold, Hot, Nurture, House, or Referral.
- [ ] Confirm a new import cannot be placed directly into Open Pool.
- [ ] Disqualify a separate test record with a documented reason.
- [ ] Suppress a separate test record with a documented compliance reason.
- [ ] Confirm admin suppression cancels scheduled callbacks, clears next action, writes audit evidence, and removes active-work access.

**Pass condition:** New imports cannot bypass review or Open Pool protection.

## 4. Claim boundary and ownership test

- [ ] With Agent A, claim one eligible test Lead.
- [ ] With Agent B still uncertified, attempt the same claim and confirm it is denied.
- [ ] Confirm Agent A can see and work the claimed Lead.
- [ ] Confirm Agent B cannot view or alter Agent A’s assigned Lead.
- [ ] Confirm claim/activity/audit evidence exists.
- [ ] After the denial test, optionally certify Agent B temporarily and use two sessions to attempt a simultaneous claim on one eligible Open Pool return.
- [ ] Confirm only one atomic claim succeeds.

**Pass condition:** Certification and server-side owner checks are enforced; only one agent can win a claim.

## 5. Agent activity, callbacks, and contact safety

Using the owning agent:

- [ ] Log No Answer and confirm activity history.
- [ ] Schedule a future callback and confirm it appears in Tasks.
- [ ] Create a newer callback and confirm the prior scheduled callback closes.
- [ ] Log Qualified with a note and confirm two-way contact is recorded.
- [ ] Log Wrong Number and confirm invalid-contact suppression removes the Lead from active work.
- [ ] On a fresh owned Lead, schedule a callback, apply DNC, and confirm all scheduled callbacks are cancelled.
- [ ] Confirm a DNC/suppressed Lead cannot be reclaimed or re-imported by the same identifier.

**Pass condition:** Callbacks, activity, notes, DNC, invalid-contact suppression, and ownership behave consistently.

## 6. Open Pool return protection

Prepare a non-referral Lead that has prior ownership, documented two-way contact, no DNC/suppression status, and lifecycle `CLAIMED`, `CONTACTED`, or `NURTURING`.

- [ ] Return it from `/admin/leads/release` with a reason.
- [ ] Confirm owner clears, pool becomes `OPEN`, lifecycle becomes `AVAILABLE`, and audit/claim/activity records exist.
- [ ] Confirm a new untouched Lead cannot be returned.
- [ ] Confirm a referral, `DEMO_BOOKED`, DNC/suppressed, or no-two-way-contact Lead is blocked.

**Pass condition:** Open Pool contains only documented eligible returns.

## 7. GHL appointment lifecycle

Use test data through `/api/ghl/appointments`. Include `mini_crm_lead_id` whenever available; otherwise use the known GHL contact ID.

- [ ] `APPOINTMENT_BOOKED` → matching Lead becomes `DEMO_BOOKED`.
- [ ] `APPOINTMENT_CONFIRMED` → Lead remains `DEMO_BOOKED`.
- [ ] `APPOINTMENT_RESCHEDULED` → Lead remains `DEMO_BOOKED`; appointment updates.
- [ ] `APPOINTMENT_CANCELLED` → same-owner follow-up is created/expedited.
- [ ] `APPOINTMENT_NO_SHOW` → same-owner follow-up is created/expedited.
- [ ] `APPOINTMENT_COMPLETED` → retained in recent schedule history.
- [ ] Confirm ownership is unchanged for all matched events.
- [ ] Retry one exact GHL event ID and confirm no duplicate MiniCRM work is created.
- [ ] Confirm valid machine-readable time/timezone values are used; no display-text timestamp token is relied on.

**Pass condition:** Only the intended Lead and appointment are updated, with no ownership transfer or duplicate work.

## 8. GHL opportunity-result relay

Configure and test `/api/ghl/opportunities` using unique event IDs.

- [ ] `OPPORTUNITY_WON` on a matched active Lead → `CLOSED_WON`.
- [ ] `OPPORTUNITY_LOST` on a separate matched open Lead → `CLOSED_LOST`.
- [ ] A later `OPPORTUNITY_LOST` event against the Closed Won test Lead does not reverse the win.
- [ ] Retry one event ID and confirm no duplicate work is created.
- [ ] Send an event for a suppressed test Lead and confirm its lifecycle is unchanged.
- [ ] Confirm Integration Monitor records the event and audit trail records attribution.

**Pass condition:** GHL opportunity results are matched safely, preserve ownership, and cannot overwrite protected lifecycle states.

## 9. GHL inbound-reply relay

Configure and test `/api/ghl/replies` using unique event IDs.

- [ ] Send an Email or SMS reply for an owned active test Lead; confirm the reply is logged, two-way contact is present, and exactly one immediate callback appears in Tasks and Inbox.
- [ ] Create an existing future callback before the reply; confirm the reply expedites it rather than creating a duplicate.
- [ ] Send a reply for an unassigned active Lead; confirm it appears in `/admin/leads/replies`.
- [ ] Assign the warm reply to an active agent; confirm atomic assignment, audit evidence, and immediate callback.
- [ ] Retry the same event ID; confirm no duplicate note, callback, or assignment work is created.
- [ ] Send a reply for a suppressed test Lead; confirm the Lead state is unchanged.

**Pass condition:** Replies route only to permitted work queues and never bypass DNC/suppression protection.

## 10. Verified Closed Won → Client Service boundary

This is a boundary check, not Servicing activation.

- [ ] From an active `DEMO_BOOKED` test Lead, record a documented Verified Closed Won decision.
- [ ] Confirm the Lead becomes `CLOSED_WON` and appears in Client Onboarding Queue when Servicing is intentionally available for controlled test.
- [ ] Confirm a non-won, DNC, suppressed, or already-linked Lead is rejected for Client Account creation.
- [ ] Confirm the standard servicing workspace does not provide a generic normal account-creation bypass.

**Pass condition:** Client onboarding begins only from a verified Closed Won Lead with preserved ownership/GHL context.

## 11. Sign-off and cleanup

- [ ] Every blocking step has Pass evidence, or any Fail/Deferred item has an owner-approved remediation plan.
- [ ] Check Integration Monitor and Resolved History; do not mark historical failures resolved until a successful new event has been confirmed.
- [ ] Confirm no unexpected runtime or integration errors are unresolved.
- [ ] Disqualify or suppress test Leads so they are excluded from outreach.
- [ ] Record the owner decision and first live-batch limit.

### Owner approval

- Test date: ____________________
- Approved by: ____________________
- Controlled test feature-gate window: ____________________
- First live batch size: ____________________
- Notes / exceptions: ____________________

## After approval

Keep Leads in a controlled rollout, review audit and Integration Monitor records, and expand volume only after the first approved batch behaves as expected. Do not enable Servicing, Commissions, or Finance merely because the Lead test passes.
