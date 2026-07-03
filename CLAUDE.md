# Mercury Call Desk Mini CRM — Project Instructions

## Start Here

Before changing code, read:

1. `README.md`
2. `docs/INDEX.md`
3. `docs/DAILY_LOG.md`
4. `docs/REBUILD_V1_SPEC.md`
5. `docs/REBUILD_V1_PREVIEW_ENVIRONMENT.md`
6. `docs/CODEBASE_AUDIT.md`
7. `docs/DATABASE_SCHEMA_INVENTORY.md`

## Current Rebuild State — 2026-07-03

- **Known-good recovery baseline:** `recovery/e59-route-fix` at `92c052a99c3d0375ca178abc589ee90d38d033bf`
- **Rebuild foundation branch:** `rebuild/v1-foundation`
- **Active Milestone 1 branch:** `rebuild/m1-role-shell`
- **Audit documentation branch:** `docs/rebuild-audit-2026-07-03`
- **Current Milestone 1 Preview:** `https://crm-mcd-git-rebuild-m1-role-shell-hamiltons-projects-f65eeb81.vercel.app`
- **Preview database only:** Neon branch `preview-rebuild-v1` (`br-twilight-snow-aj4widc4`)
- **Production:** frozen; do not modify `main`, production Vercel variables, production Neon schema, or production data without explicit owner approval.

## Mandatory Delivery Workflow

1. Create a focused branch from the approved rebuild branch.
2. Limit changes to one milestone or acceptance target.
3. Update `README.md`, `docs/DAILY_LOG.md`, and `docs/INDEX.md` whenever scope, environment, release status, or next steps change.
4. Commit the documentation with the implementation change.
5. Wait for Vercel Preview to be `READY`.
6. Test only the requested paths in Preview.
7. Check runtime logs for unhandled errors.
8. Record the result in `docs/DAILY_LOG.md` before asking for the next acceptance test.
9. Do not merge to `main` or deploy to production without explicit owner approval.

## Authentication and Authorization

- The currently working credentials + MFA flow is frozen unless a dedicated authentication task is approved.
- All protected routes must authorize server-side.
- UI visibility does not replace authorization checks.
- Admin roles: `OWNER`, `SUPER_ADMIN`, `SALES_MANAGER`, `COMPLIANCE_MANAGER`, `FINANCE_MANAGER`.
- Applicant-review actions are limited to `OWNER`, `SUPER_ADMIN`, and `SALES_MANAGER`.
- Agents may access only their own permitted portal data and allowed Open Pool records when lead access is enabled.

## Preview Isolation Rules

- Preview must use `preview-rebuild-v1`, never the production Neon branch.
- `DATABASE_URL` and `DIRECT_URL` must be Preview-only Vercel values pointing to the Preview Neon branch.
- Do not use production GoHighLevel, SMTP, Stripe, payout, or document-storage credentials in Preview.
- No secret or connection string belongs in the repository.
- Before re-enabling any integration action, implement and test an application-level Preview/test-mode guard; Vercel variable scoping alone is not sufficient release protection.

## Schema Source-of-Truth Gate

- `database/migrations/20260702_002_client_servicing_health.sql` is the approved SQL baseline for the four Client Servicing Health tables.
- Those tables are present on the Preview database, but the active `prisma/schema.prisma` does not yet represent them.
- This is migration-to-ORM drift, not permission to create another service migration.
- Do not write Prisma-based servicing, commission, House-transfer, or database-change code until the Prisma schema is reconciled against the approved SQL baseline in a no-migration branch.
- Do not run `prisma migrate deploy` against production. Record every future production schema release in the migration ledger and the daily log.

## Business Rules That Must Not Regress

- DNC and suppression block prohibited sales contact.
- Healthy current-paying client accounts are not reassigned merely because there is no routine activity.
- Good-standing departing agents retain commissions only while they continue servicing assigned clients; accounts move to House when they stop servicing them.
- Retired agents retain applicable commissions; terminated agents lose future commission rights and accounts move to House.
- Closed Won requires authorized verification, a note, lifecycle validation, and an audit event.
- The CRM does not automatically issue payouts.

## Route Safety

- Never create duplicate dynamic route names at the same Next.js route level.
- The prior failure involved competing `[id]` and `[leadId]` segments under the same path. Use the canonical route name only.
- Before adding a dynamic route, inspect adjacent route folders.

## Current Milestone 1 Scope

- Admin workspace shell
- Role-aware Admin overview
- Applicant Review moved to `/admin/applicants`
- Existing Partner Portal remains available

Out of scope for this milestone:

- auth changes
- database schema changes
- lead/client/commission writes
- GoHighLevel actions
- production changes
