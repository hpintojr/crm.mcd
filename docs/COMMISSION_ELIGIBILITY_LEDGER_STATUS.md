# Commission Eligibility & Ledger Status

**Status:** Staged behind `COMMISSIONS_ENABLED=false`  
**Finance state:** `FINANCE_ENABLED=false`  
**Production database:** No commission schema has been applied.

## Purpose

This phase records eligibility decisions, proposed ledger items, and holds. It does not initiate any transfer of funds.

## Policy currently encoded

- Active agents remain eligible only while they service the assigned client account.
- Retired agents keep eligibility for existing client accounts.
- Terminated agents are not eligible for future entries.
- Accounts with unresolved payment issues stay on hold.
- House transfers and missing service ownership prevent active-agent eligibility.
- No automatic rate formula is enabled.

## Prepared database migration

- Migration ID: `20782486-2c31-4132-b192-05a8efac836f`
- Temporary branch: `mcp-migration-2026-07-02T19-03-12`
- Temporary branch ID: `br-young-dawn-ajhq6r2y`
- Parent production branch: `br-flat-cloud-aj9r0d6b`

The migration completed on the temporary branch. Connector-level branch inspection is currently blocked before execution, so this migration is not approved for production apply.

## Repository work completed

- Commission-only migration file is committed.
- Pure eligibility evaluator is committed in `src/lib/commission-policy.ts`.
- Policy check script is committed in `scripts/check-commission-policy.ts`.
- Read-only admin route is committed at `/admin/commissions`.
- Latest Vercel build completed successfully with no error/fatal runtime logs returned.

## Next gate

Validate the temporary Neon branch, then review and explicitly approve the commission schema migration. Finance remains a separate later phase.
