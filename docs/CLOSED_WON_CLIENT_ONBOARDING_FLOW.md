# Closed-Won Client Onboarding Flow

## Purpose

Move a valid `CLOSED_WON` Lead into Client Servicing without creating duplicate accounts, commission entries, payment records, or payouts.

## Required gates

- `LEADS_ENABLED` is intentionally enabled for the controlled test.
- `SERVICING_ENABLED` is intentionally enabled for the controlled test.
- The Lead is `CLOSED_WON`, not DNC, and not suppressed.
- An admin performs the conversion.

## Operations sequence

1. Review the closed-won Lead in `/admin/leads/[leadId]`.
2. Use `/admin/servicing/onboarding` to find won Leads without Client Accounts.
3. Select **Create client account** and provide the package code.
4. The Mini CRM creates one linked Client Account, carrying the Lead link, current owner context, originating owner context, and GHL contact mapping.
5. The system prevents duplicate conversion in the normal workflow through a transaction-level advisory lock.
6. Complete the documented launch confirmation at `/admin/servicing/[clientAccountId]/launch`.
7. Launch completion creates service activity and audit history, then moves the account to Active when current on payments, or Payment Failed when a payment issue already exists.
8. Manage normal ongoing service through the Client Servicing workspace.

## Explicit boundaries

- This flow does not calculate a commission.
- This flow does not record payment collection.
- This flow does not approve Finance work.
- This flow does not create or send a payout.
- Automatic won-opportunity → Client Account creation stays disabled until the separate Client Account GHL identity correction is validated and approved.

## Database hardening pending approval

The repository includes `database/migrations/20260702_006_unique_client_account_lead.sql`, which adds a database-level one-account-per-Lead guard. It is not applied to production yet.
