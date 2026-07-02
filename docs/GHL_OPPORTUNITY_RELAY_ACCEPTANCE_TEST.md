# GHL Opportunity Relay Acceptance Test

**Purpose:** Verify the GHL won/lost opportunity relay updates only the correct Mini CRM Lead.

## Preconditions

- [ ] Use an approved GHL location and webhook secret.
- [ ] Use `TEST —` Leads only.
- [ ] `LEADS_ENABLED=true` only during the controlled test window.
- [ ] Match the target Lead with `mini_crm_lead_id` whenever possible; use `ghl_contact_id` only as fallback.

## Won event

Send a verified event with:

- `event_type: OPPORTUNITY_WON`
- a unique `ghl_event_id`
- `ghl_opportunity_id`
- a target Lead match field

Confirm:

- [ ] The matching Lead moves to `CLOSED_WON`.
- [ ] GHL opportunity/contact identifiers are recorded when supplied.
- [ ] The Lead owner does not change.
- [ ] Next action is cleared.
- [ ] Audit history records GHL opportunity attribution and relay processing.

## Lost event

Repeat with `event_type: OPPORTUNITY_LOST`.

Confirm:

- [ ] The matching Lead moves to `CLOSED_LOST`.
- [ ] Lead owner remains unchanged.
- [ ] Audit history records the result.

## Idempotency and safeguards

- [ ] Replay the same `ghl_event_id`; confirm the relay acknowledges the duplicate without changing the Lead again.
- [ ] Send an event with no matching Lead; confirm it is recorded without creating a Lead.
- [ ] Send a malformed payload; confirm it is rejected.
- [ ] Send an event from an unapproved location or without valid webhook verification; confirm it is rejected.
- [ ] Confirm the relay does not create a Client Account automatically.

## Client onboarding boundary

After a verified `CLOSED_WON` result:

- [ ] Use `/admin/servicing/onboarding` to create the linked Client Account manually.
- [ ] Complete the documented launch confirmation.
- [ ] Confirm no commission or payout record is created as a side effect.
