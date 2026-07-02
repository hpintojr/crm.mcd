# Demo-Booked GHL Handoff Acceptance Test

**Scope:** Verify the Mini CRM → GHL contact handoff after a Lead is marked `DEMO_BOOKED`.

## Preconditions

- [ ] `LEADS_ENABLED=true` only within the controlled test window.
- [ ] Use a `TEST —` Lead with lifecycle `DEMO_BOOKED`.
- [ ] The test Lead is not DNC or suppressed.
- [ ] An admin user is signed in.
- [ ] GHL token/location configuration is either intentionally connected or intentionally left in stub-safe mode.

## Handoff behavior

- [ ] Open `/admin/leads/handoff`.
- [ ] Confirm the test Lead appears only when it is `DEMO_BOOKED`, non-DNC, and non-suppressed.
- [ ] Select **Handoff to GHL**.
- [ ] Confirm `ghlContactId` is saved to the Lead.
- [ ] Confirm a Lead activity and audit entry are created.
- [ ] If GHL is unconfigured, confirm the local test uses the documented stub-safe contact result and records it in audit metadata.
- [ ] If GHL is configured, confirm a contact is created/updated under the server-side GHL location without giving the agent GHL credentials.

## Guardrails

- [ ] Attempt handoff for a non-demo Lead; confirm it is blocked.
- [ ] Attempt handoff for a DNC/suppressed Lead; confirm it is blocked.
- [ ] Re-run handoff for a Lead already linked to GHL; confirm no duplicate contact is created and an audit skip record is written.
- [ ] Confirm existing Lead ownership does not change during handoff.
- [ ] Confirm unmatched inbound GHL appointment events still do not create a new Lead.

## Failure handling

- [ ] Simulate or observe a GHL failure.
- [ ] Confirm an IntegrationError and failure AuditLog entry are created.
- [ ] Confirm the Lead remains unlinked and can be reviewed by an admin.

## Sign-off

- Test date: ____________________
- Approved by: ____________________
- GHL mode: Connected / Stub-safe
- Notes: ____________________
