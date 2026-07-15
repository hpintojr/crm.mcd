# Stripe Connect Readiness (Staged)

**Status:** Design and policy foundation only. Stripe Connect is an optional future payout route; it is not active, does not collect payment, and cannot initiate a payout from the MiniCRM.

## Operating decision

Mercury Call Desk defaults to **manual external payout tracking**. Stripe Connect is retained as an optional agent-destination route for a later, separately authorized release.

- The production Commission and Finance feature gates remain closed.
- The staged Payout Destination record may retain only a provider name, a Stripe Connected Account reference, onboarding/payout capability state, and a last-checked timestamp.
- The CRM never stores bank-account, card, tax-document, SSN, EIN, or provider-secret data.
- No code in this stage creates Connected Accounts, sends onboarding links, collects payments, creates Transfers, creates Payouts, or changes a Stripe balance.
- A reviewed payout still requires a recorded manual admin approval. A future provider release needs an additional explicit authorization and controlled test window.

## Agent and admin experience contract

| Audience | Can see | Cannot see |
|---|---|---|
| Agent | Their commission status, holds at a safe summary level, payout route selected, connection/onboarding state, and payout history/reference after Finance records it | GHL credentials, wholesale pricing, raw processor fees, other agents' records, bank/tax/card data, provider secrets |
| Commission admin | Ledger eligibility, cleared-funds state, holds, review evidence, draft/approved batch state, destination readiness, and a non-sensitive provider reference | Raw financial-account or provider-secret data |
| Finance approver | The full audited decision chain and the selected payout route | Any transfer/payout action until the separately approved execution release |

The agent-facing dashboard should describe the route as one of: `Manual external`, `Connect setup needed`, `Connect verification pending`, `Finance review`, `Approved for manual processing`, or `On hold`. It should never imply that approval has sent money.

## Canonical future data flow

```text
Stripe event
  -> signature-verified backend intake and idempotency record
  -> retrieve the finalized processor fee
  -> commission ledger / eligibility / holds
  -> GoHighLevel status and tag write-back
  -> Commission admin review
  -> Finance approval + recorded manual decision
  -> manual external processing (current default)
     OR later Stripe Connect transfer execution (separate approved release)
```

Direct Stripe-to-GHL mapping is insufficient for the production path because the backend must verify the event, prevent duplicates, reconcile finalized processor fees, and preserve the audit trail before writing CRM status.

## Readiness states

`src/lib/stripe-connect-readiness.ts` is a pure policy helper. It supports two routes:

- `MANUAL_EXTERNAL` — current default. No Connected Account is required.
- `STRIPE_CONNECT` — requires server configuration, a provider-account reference, completed onboarding, provider payout capability, Commission/Finance readiness, recorded manual approval, and a deliberately enabled execution flag before it can reach **ready for admin review**.

The helper never permits a provider call. Its result always reports `providerExecutionPermitted: false`.

## Controlled test sequence before any Connect release

1. Keep `COMMISSIONS_ENABLED` and `FINANCE_ENABLED` closed.
2. Configure test-only webhook signing and route configuration in the server environment; never place values in GHL, agent views, commits, or test notes.
3. Use a synthetic internal agent and a Stripe Sandbox Connected Account.
4. Verify duplicate event handling, incorrect-signature rejection, event-to-ledger reconciliation, safe GHL write-back, hold behavior, and manual approval audit evidence.
5. Record pass/fail/deferred evidence in the Commission acceptance board.
6. Obtain a new written approval for any migration, feature-gate opening, provider-account creation, onboarding link, transfer, payout, or live-mode activity.

## Current external setup

Stripe Connect's **Sandbox** onboarding guide is open at the business-model selection step. No Connected Account, onboarding link, transfer, payout, live-mode configuration, or feature-gate change was created by this staged foundation.
