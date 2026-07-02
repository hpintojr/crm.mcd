# Database Release Process

## Purpose

This repository treats the Neon production database as a separate release target. Vercel deploys application code; database changes are reviewed and released separately.

## Rules

- Do not run a blanket Prisma deployment against production.
- Use the direct Neon connection for schema work, not the pooled runtime connection.
- Every release starts from a fresh Neon branch created from production.
- Apply only the migration set named in the release scope.
- Record the production baseline and each approved release in `_mcd_schema_migrations`.
- Keep feature flags disabled until the database migration, Vercel build, and controlled live tests pass.
- Do not include servicing, commission, finance, or payout structures in the Lead MVP release.

## Lead MVP release scope

1. `20260702_000_production_baseline.sql`
2. `20260701091000_add_lead_engine/migration.sql`
3. `20260701091100_add_lead_integrity/migration.sql`
4. `20260702130000_add_lead_import_taxonomy/migration.sql`

## Required release sequence

1. Create a fresh Neon safety branch from production.
2. Point the protected GitHub `neon-safety` environment at that branch's direct connection string.
3. Run the `Database Release Gate` workflow against `neon-safety` using `APPLY_SAFETY_LEAD_MVP`.
4. Confirm the logged migration fingerprints match the approved Lead MVP files.
5. Run the Lead MVP migration against the safety branch as one transaction.
6. Run schema verification and controlled app tests.
7. Review the GitHub Actions log and approve the protected `production` environment.
8. Run the `Database Release Gate` workflow against `production` using `APPLY_PRODUCTION_LEAD_MVP`.
9. Run the same immutable migration files against production.
10. Re-run verification against production.
11. Keep `LEADS_ENABLED=false` until import, claim, callback, suppression, release, and GHL appointment tests pass.

## GitHub environment setup

Create two GitHub Environments for this repository:

- `neon-safety`: add secret `MIGRATION_DATABASE_URL` for the current safety branch.
- `production`: add secret `MIGRATION_DATABASE_URL` for the production main branch and require reviewer approval before jobs may run.

Never store either connection string in the repository, Vercel, or issue comments.

## Rollback

The Lead MVP schema is additive. Before a production apply, use Neon point-in-time restore or a new restore branch if rollback is required. Do not drop Lead tables while the application feature is enabled or while production data exists.
