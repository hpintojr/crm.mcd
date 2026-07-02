# Commission Eligibility & Ledger Status

**Status:** Operational controls are built behind `COMMISSIONS_ENABLED=false`  
**Finance state:** `FINANCE_ENABLED=false`  
**Production database:** No commission schema has been applied.

## Purpose

This phase records eligibility decisions, proposed ledger items, payment-clearance evidence, and holds. It does not initiate any transfer of funds.

## Policy currently encoded

- Active agents remain eligible only while they service the assigned client account.
- Retired agents keep eligibility for existing client accounts.
- Terminated agents are not eligible for future entries.
- Accounts with unresolved payment issues stay on hold.
- House transfers and missing service ownership prevent active-agent eligibility.
- New ledger entries always begin as pending verification.
- Payment clearance can mark an entry eligible only when there is a current eligible decision and no active hold.
- Releasing a hold returns the entry to pending verification; it never restores eligibility automatically.
- No automatic rate formula is enabled.
- Finance readiness is a separate manual-review boundary and contains no payment execution action.

## Prepared database migration

- Migration ID: `20782486-2c31-4132-b192-05a8efac836f`
- Temporary branch: `mcp-migration-2026-07-02T19-03-12`
- Temporary branch ID: `br-young-dawn-ajhq6r2y`
- Parent production branch: `br-flat-cloud-aj9r0d6b`

The migration completed on the temporary branch. Connector-level branch inspection is currently blocked before execution, so this migration is not approved for production apply.

## Repository work completed

- Commission-only migration file is committed.
- Pure eligibility, ledger-readiness, and Finance-readiness evaluators are committed.
- Policy check script is committed in `scripts/check-commission-policy.ts` and can be run through `npm run check:commission-policy`.
- GitHub Actions policy workflow is committed.
- Gated admin workspaces are committed:
  - `/admin/commissions` for profiles and eligibility review.
  - `/admin/commissions/ledger` for controlled ledger intake, holds, and payment-clearance evidence.
  - `/admin/finance` for readiness boundaries only.
- No raw bank, routing, card, wallet, or provider credential is stored by this work.
- No payout instruction, payout batch, provider connection, or fund-transfer action is present.

## Next gate

1. Validate the temporary Neon branch.
2. Review and explicitly approve the separate commission schema migration.
3. Run `docs/COMMISSION_ELIGIBILITY_LEDGER_ACCEPTANCE_TEST.md` during a controlled feature-gated test.
4. Keep Finance disabled until its separate review-only acceptance gate is approved.
