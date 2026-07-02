# GHL Opportunity Relay Contract

**Endpoint:** `POST /api/ghl/opportunities`

This endpoint receives verified GHL outcome events and updates the matching Mini CRM Lead. It is idempotent by `ghl_event_id`.

## Supported events

- `OPPORTUNITY_WON` → matching Lead becomes `CLOSED_WON`.
- `OPPORTUNITY_LOST` → matching Lead becomes `CLOSED_LOST`.

## Required payload fields

```json
{
  "ghl_event_id": "unique-event-id",
  "location_id": "approved-ghl-location-id",
  "event_type": "OPPORTUNITY_WON",
  "ghl_opportunity_id": "opportunity-id"
}
```

## Lead matching fields

Use one of the following in the payload:

- `mini_crm_lead_id` — preferred exact Mini CRM Lead match.
- `ghl_contact_id` — fallback match against a Lead already linked to a GHL contact.

## Expected behavior

- Webhook authentication and approved-location checks run before processing.
- Duplicate event IDs are acknowledged without reprocessing.
- When Leads are gated off, the event is recorded but does not update a Lead.
- Unmatched events are recorded without creating a new Lead.
- Matched events update Lead lifecycle, GHL opportunity ID, GHL contact mapping when supplied, and audit history.
- This relay does **not** create a Client Account yet. Client-account auto-creation waits for the separate ClientAccount GHL identity correction that allows many accounts to share one GHL location.

## Response

```json
{
  "ok": true,
  "relayed": true,
  "leadMatched": true,
  "leadGated": false
}
```
