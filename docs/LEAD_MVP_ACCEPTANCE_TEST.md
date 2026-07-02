# Lead MVP Acceptance Test

**Purpose:** Verify the Lead MVP before `LEADS_ENABLED` is changed to `true` for normal agent access.

**Rule:** Keep `LEADS_ENABLED=false` until the owner signs off on this checklist. Use only internal test contact details and clearly label every test company `TEST —`.

## 1. Pre-activation review

- [ ] Confirm the current Vercel production deployment is `READY`.
- [ ] Confirm `LEADS_ENABLED=false` before the test window starts.
- [ ] Confirm `SERVICING_ENABLED=false`, `COMMISSIONS_ENABLED=false`, and `FINANCE_ENABLED=false`.
- [ ] Confirm the GHL webhook secret and location allowlist are configured in Vercel; do not expose either value in the CRM or test notes.
- [ ] Confirm one admin test account and two certified agent test accounts are available.
- [ ] Confirm the test phone numbers and emails are internal/non-customer test data.

## 2. Controlled test activation

1. In Vercel production environment variables, set `LEADS_ENABLED=true`.
2. Redeploy or promote the deployment that reads the updated environment value.
3. Confirm `/admin/leads` is available to an admin.
4. Confirm `/portal/leads` is available only to an authenticated, certified agent.
5. Confirm an uncertified agent cannot claim Leads.

**Pass condition:** Only intended test users can reach the Lead workflows.

## 3. Import and review queue

Send a small JSON batch to `POST /api/admin/leads/import` using the admin session. Begin with no more than five records.

### Required test records

| Record | Expected result |
|---|---|
| Valid business with internal test phone, source `WEB_FORM`, intake `MANUAL_ENTRY` | Created as `PENDING_REVIEW` |
| Duplicate of the valid business in the same batch | Rejected as batch duplicate |
| Second import of the same valid business | Rejected as existing Mini CRM duplicate |
| Business using an identifier already on an active suppression record | Rejected; no Lead created |
| Google Maps + `SCRAPE_IMPORT` record | Rejected by source policy |
| Referral record with referrer name | Created as `PENDING_REVIEW`, with referral attributes retained |

**Pass conditions:**

- [ ] Only valid, non-suppressed, non-duplicate rows are created.
- [ ] All created rows begin in `PENDING_REVIEW`.
- [ ] No created row appears in an agent workspace before admin review.
- [ ] Review queue displays source, contact information, and lifecycle correctly.

## 4. Admin review and pool protection

For a valid pending record:

- [ ] Approve it to `COLD`, `HOT`, `NURTURE`, `HOUSE`, or `REFERRAL`.
- [ ] Confirm the review page does not offer Open Pool for a new import.
- [ ] Disqualify a second test record with a required reason.
- [ ] Suppress a third test record with a required compliance reason.
- [ ] Confirm suppressed records do not appear in agent work or future import eligibility.

**Pass condition:** New imports cannot be moved directly into Open Pool.

## 5. Claim race and agent ownership

Create or return one eligible test Lead to Open Pool using the documented admin return process. Use two separate certified-agent browser sessions.

- [ ] Both agents can see the eligible record before a claim attempt.
- [ ] Have both agents attempt to claim the same record at the same time.
- [ ] Confirm only one claim succeeds.
- [ ] Confirm the winner can see and act on the record in My Active Records.
- [ ] Confirm the other agent cannot view or alter the assigned record.
- [ ] Confirm claim history and audit history record the event.

**Pass condition:** Claiming is atomic and ownership is enforced server-side.

## 6. Agent activity and callback workflow

Using the owning agent:

- [ ] Log `No answer`; confirm lifecycle remains active and a note/activity entry is recorded.
- [ ] Log `Callback requested` with a future Pacific time; confirm the callback appears in history and becomes the next action.
- [ ] Create a newer callback; confirm the prior scheduled callback is closed and the new callback is active.
- [ ] Log `Qualified` with a note; confirm two-way-contact status is established.
- [ ] Log `Wrong number`; confirm the Lead is suppressed, invalid-contact suppression exists, and the record leaves the agent’s active list.

**Pass condition:** Activities, notes, lifecycle updates, follow-ups, and invalid-contact suppression are recorded consistently.

## 7. Immediate DNC test

On a fresh test Lead owned by an agent:

- [ ] Schedule a callback.
- [ ] Apply DNC with a reason.
- [ ] Confirm lifecycle becomes `SUPPRESSED`.
- [ ] Confirm `dnc=true` and `suppressed=true` behavior in the interface.
- [ ] Confirm scheduled callbacks are cancelled.
- [ ] Confirm a DNC suppression record, Lead activity, and AuditLog entry are created.
- [ ] Confirm the Lead disappears from agent work and cannot be reclaimed.
- [ ] Attempt to import the same phone/email again; confirm it is rejected.

**Pass condition:** DNC is immediate and blocks current and future workflow access.

## 8. Open Pool return rules

Prepare a Lead that has all of the following: current agent owner, documented two-way contact, no DNC/suppression status, non-referral status, and a lifecycle of `CLAIMED`, `CONTACTED`, or `NURTURING`.

- [ ] Use `/admin/leads/release` to return it with a reason.
- [ ] Confirm owner is cleared, pool becomes `OPEN`, lifecycle becomes `AVAILABLE`, and the release time is set.
- [ ] Confirm a claim event, activity, and audit entry exist.
- [ ] Attempt to return an untouched/new Lead; confirm it is blocked.
- [ ] Attempt to return a referral Lead; confirm it is blocked.
- [ ] Attempt to return a `DEMO_BOOKED` Lead; confirm it is blocked and absent from the eligible return list.
- [ ] Attempt to return a DNC/suppressed Lead; confirm it is blocked.
- [ ] Attempt to return a Lead without two-way contact; confirm it is blocked.

**Pass condition:** Open Pool contains only documented returns that meet the protection rules; referrals and demo-booked records never enter it.

## 9. GHL appointment attribution

Use the verified GHL appointment webhook with internal test data. Include `mini_crm_lead_id` whenever available; otherwise use a known matching `ghl_contact_id`.

| Event | Expected Lead result |
|---|---|
| `APPOINTMENT_BOOKED` | Lifecycle becomes `DEMO_BOOKED` |
| `APPOINTMENT_CONFIRMED` | Lifecycle remains `DEMO_BOOKED` |
| `APPOINTMENT_RESCHEDULED` | Lifecycle remains `DEMO_BOOKED` and appointment reference updates |
| `APPOINTMENT_CANCELLED` | Lifecycle becomes `CONTACTED`; callback is created for existing owner |
| `APPOINTMENT_NO_SHOW` | Lifecycle becomes `CONTACTED`; callback is created for existing owner |
| Unmatched contact/Lead | Appointment webhook remains recorded; no new Lead is created |

For each matched event:

- [ ] Confirm the appointment record is created or updated.
- [ ] Confirm the same Lead retains the same owner.
- [ ] Confirm Lead activity and audit history are recorded.
- [ ] Replay the exact webhook event ID; confirm the idempotency control prevents double processing.

**Pass condition:** GHL appointment events update only the intended Lead and never reassign ownership.

## 10. Sign-off and first live batch

Before normal use:

- [ ] Every blocking test above passes.
- [ ] No unexpected application errors appear in Vercel runtime logs.
- [ ] Test records are disqualified or suppressed and are excluded from outreach.
- [ ] Owner approves the first live import batch and the responsible admin.
- [ ] First live batch is limited to a small approved group and is reviewed before assignment.

### Owner approval

- Test date: ____________________
- Approved by: ____________________
- First live batch size: ____________________
- Notes / exceptions: ____________________

## After approval

Keep `LEADS_ENABLED=true` only for the controlled rollout. Continue to monitor activity, suppression, claim, and webhook audit records before expanding volume.

Do not enable Client Servicing, Commissions, or Finance until the Lead MVP has completed its stabilization period and the owner authorizes the next phase.
