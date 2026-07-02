# Finance Readiness Acceptance Test

**Purpose:** Confirm the Finance boundary before `FINANCE_ENABLED` is considered for a controlled, review-only rollout.

**This phase does not authorize payments, create transfer instructions, or store raw bank information.**

## Preconditions

- [ ] Commission Eligibility & Ledger has passed its controlled acceptance test.
- [ ] `npm run check:commission-policy` passes.
- [ ] No payment provider integration, payout instruction, or money-movement control is enabled.
- [ ] No raw bank, routing, card, wallet, or provider credential is stored in the Mini CRM.

## Readiness blockers

For a test ledger entry, confirm each condition blocks a manual Finance review state:

- [ ] Finance feature is disabled.
- [ ] Commission eligibility is not current.
- [ ] Underlying payment is not cleared.
- [ ] An active hold exists.
- [ ] Finance approval has not been documented.
- [ ] An external destination reference has not been verified.

## Controlled readiness path

Confirm all of these must be true before a record is labeled **Ready for manual review**:

- [ ] `FINANCE_ENABLED=true` only during the controlled test window.
- [ ] Current commission eligibility is present.
- [ ] Payment clearance is recorded.
- [ ] No active hold remains.
- [ ] Finance approval is documented.
- [ ] A verified external destination reference exists outside the CRM.

## Hard boundaries

- [ ] The Finance workspace contains no transfer, disbursement, provider-execution, or payout-release action.
- [ ] A ready result means manual review only, never automatic payment.
- [ ] Any external financial action remains human-controlled and subject to company/provider approval.

## Owner approval

- Review date: ____________________
- Approved by: ____________________
- Notes / exceptions: ____________________
