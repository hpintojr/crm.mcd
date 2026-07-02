# Commission Eligibility & Ledger Acceptance Test

**Purpose:** Verify the commission eligibility and ledger phase before normal commission review is enabled.

**Rule:** Keep `COMMISSIONS_ENABLED=false` until the production schema, policy checks, and controlled test data pass. Keep `FINANCE_ENABLED=false` throughout this test.

## 1. Pre-activation gate

- [ ] Commission migration has been validated on the isolated Neon branch.
- [ ] Production migration is approved separately from this checklist.
- [ ] Latest Vercel build is `READY`.
- [ ] `COMMISSIONS_ENABLED=false` and `FINANCE_ENABLED=false` before the test window begins.
- [ ] Use only `TEST —` client accounts, test agents, and internal payment references.

## 2. Eligibility decision rules

For an active, current-paying account assigned to Agent A:

- [ ] Set Agent A commission profile to active.
- [ ] Review eligibility for Agent A.
- [ ] Confirm result is eligible for active service.

For a retired agent with an existing client relationship:

- [ ] Set the retired agent profile to retired.
- [ ] Review eligibility using an existing client account.
- [ ] Confirm result is eligible under the retirement rule.

For a terminated agent:

- [ ] Set the profile to terminated.
- [ ] Review eligibility.
- [ ] Confirm result is ineligible.

For a client with a payment issue:

- [ ] Mark the servicing account as not current through the servicing workflow.
- [ ] Review eligibility.
- [ ] Confirm result is on hold for payment clearance.

For a House or unassigned client:

- [ ] Transfer a test account to House or clear its servicing owner using the servicing workflow.
- [ ] Review an active agent’s eligibility.
- [ ] Confirm result is ineligible.

## 3. Decision history and audit

- [ ] Re-review the same client/agent pairing after a servicing or payment change.
- [ ] Confirm the earlier decision is preserved as superseded.
- [ ] Confirm exactly one current decision remains for the client/agent pairing.
- [ ] Confirm audit history identifies the reviewer, decision status, and reason.

## 4. Ledger readiness rules

For a test ledger record:

- [ ] Record an uncleared payment reference; confirm state is pending verification.
- [ ] Mark the payment cleared and confirm an eligible decision exists; confirm state becomes eligible.
- [ ] Apply a manual, refund, chargeback, compliance, or servicing hold; confirm state becomes on hold.
- [ ] Confirm an entry with a current hold cannot advance toward Finance review.
- [ ] Confirm the UI displays this as a review record only, with no payout action available.

## 5. Finance boundary

- [ ] Confirm `FINANCE_ENABLED=false` blocks any advance to Finance review.
- [ ] Confirm no payout batch, payment destination, provider connection, or fund-transfer action exists in the commission workspace.
- [ ] Confirm ledger proposed amounts do not independently create a payable amount or payment instruction.

## 6. Policy check

- [ ] Run `npx tsx scripts/check-commission-policy.ts`.
- [ ] Confirm active service, retirement, termination, payment hold, House transfer, missing service owner, and Finance-disabled cases pass.
- [ ] Confirm the GitHub Action named `Commission Policy` completes successfully after the commit.

## Owner approval

- Test date: ____________________
- Approved by: ____________________
- Test client accounts: ____________________
- Notes / exceptions: ____________________

## After approval

Keep `COMMISSIONS_ENABLED=true` only for the controlled commission-review rollout. Do not enable Finance until its separate payout-readiness design, migration, and acceptance test are approved.
