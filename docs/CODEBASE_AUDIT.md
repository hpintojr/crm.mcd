# Mercury Call Desk — Rebuild Codebase Audit

**Audit date:** 2026-07-03  
**Source reviewed:** `rebuild/m1-role-shell`  
**Production:** frozen; this audit changes no application, database, or external service.

## Verified

- Next.js 15, TypeScript, Tailwind, Prisma, Auth.js credentials sessions, TOTP MFA, Neon PostgreSQL, and Vercel are the active stack.
- `/admin` requires an administrative role at middleware and server-rendering layers.
- `/admin/applicants` is restricted to Owner, Super Admin, and Sales Manager.
- `/portal` resolves the signed-in user's own Agent profile and permits Agent or administrative roles.
- Failed logins, MFA failures, lockouts, successful login, and logout are audited.
- Lead queries in the Portal remain behind `LEADS_ENABLED`.
- The four client-servicing tables were created by the checked-in migration `database/migrations/20260702_002_client_servicing_health.sql` and prior rollout documentation records that this service-only schema was applied while `SERVICING_ENABLED` remained disabled.

## Rebuild Blockers

1. The checked-in client-servicing SQL migration and the Preview database contain `ClientAccount`, `ClientServiceActivity`, `ClientServiceAssignmentEvent`, and `ClientServiceCase`, but the active `prisma/schema.prisma` does not. This is migration-to-ORM source drift. Do not build ORM-based client servicing, commissions, House transfers, or new schema changes until the Prisma schema is reconciled with the approved migration baseline.
2. GHL uses stub mode when credentials are absent, but the code has no separate Preview environment hard-stop for configured external calls. Preview safety depends on Vercel variable scoping.
3. Applicant approval sends a GHL tag before its local database transaction. A successful external request followed by a failed database transaction could create system drift.
4. The acceptance checklist requires Agent MFA to `/portal` and direct `/admin` denial. This remains unrecorded. MFA is checked when an individual user has it enabled, not through a role-mandatory rule in the reviewed login logic.
5. The Applicant Review implementation was moved to `/admin/applicants`, but its revalidation and redirect targets still point to `/admin`.

## Safe Next Sequence

1. Complete the Agent MFA, Portal routing, and denied Admin Preview acceptance test.
2. Record test results and runtime observations in `docs/DAILY_LOG.md`.
3. Reconcile the Prisma schema to the approved client-servicing migration and verify it against Preview without applying a migration.
4. Add an application-level Preview integration guard before enabling any external workflow.
5. Accept Milestone 1 before starting the next focused rebuild branch.

## Not Done

- No production deployment or `main` change.
- No Neon migration or production-data write.
- No feature-gate enablement.
- No GHL, email, payment, payout, or storage action.
