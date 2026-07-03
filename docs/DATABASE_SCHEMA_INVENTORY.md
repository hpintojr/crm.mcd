# Mercury Call Desk — Database Schema Inventory

**Inventory date:** 2026-07-03  
**Neon project:** `mcd-crm-production`  
**Database:** `neondb`  
**Inspected branch:** `preview-rebuild-v1` (`br-twilight-snow-aj4widc4`)  
**Mode:** read-only inventory; no data or schema changes were made.

## Branches

| Branch | Purpose | Status |
|---|---|---|
| `main` | Production database branch | Frozen for the controlled rebuild |
| `preview-rebuild-v1` | Isolated rebuild Preview database | Active for V1 testing |
| `mcp-migration-2026-07-02T19-03-12` | Historical migration branch | Do not reuse without a dedicated review |
| `lead-mvp-clean-20260702` | Historical Lead MVP branch | Do not reuse without a dedicated review |

## Preview Database Tables

- `ActivationToken`
- `Agent`
- `Appointment`
- `AuditLog`
- `Certification`
- `ClientAccount`
- `ClientServiceActivity`
- `ClientServiceAssignmentEvent`
- `ClientServiceCase`
- `IntegrationError`
- `Lead`
- `LeadActivity`
- `LeadCallback`
- `LeadClaimEvent`
- `LeadNote`
- `LeadSuppression`
- `OnboardingDocument`
- `User`
- `WebhookEvent`
- `_mcd_schema_migrations`

## Migration-to-ORM Alignment

The active `prisma/schema.prisma` represents authentication, agent onboarding, appointments, leads, webhook events, integration errors, and audit logs.

The following Preview tables are not represented in that Prisma schema:

| Database table | Role in the operating model |
|---|---|
| `ClientAccount` | Client ownership, payment/health state, launch status, and House-transfer record |
| `ClientServiceActivity` | Triggered servicing history and documented responses |
| `ClientServiceAssignmentEvent` | Auditable servicing-assignment changes |
| `ClientServiceCase` | Client requests, payment issues, renewals, escalations, and resolution work |

The tables are not unexplained. They are defined in the checked-in migration `database/migrations/20260702_002_client_servicing_health.sql`, and prior rollout documentation records that the service-only schema was applied while the feature gate remained disabled.

The active problem is **migration-to-ORM drift**: raw SQL and the database agree on the client-servicing model, while Prisma does not. Application work using Prisma cannot safely query or evolve these tables until the schema is reconciled.

## Historical Migration Record

The database migration ledger records:

| ID | Description | Applied |
|---|---|---|
| `20260702_000_production_baseline` | Production baseline before Lead MVP rollout | 2026-07-02 |
| `20260702_001_lead_mvp` | Lead MVP schema rollout | 2026-07-02 |

The client-servicing migration is preserved as checked-in source and its historical rollout status is documented separately. The runtime ledger does not contain a matching client-servicing row, so future migration tracking must record every production schema release consistently.

## Required Reconciliation Gate

Before any new migration or ORM-based client-servicing implementation:

1. Treat the inspected Preview branch and the checked-in servicing migration as the factual baseline.
2. Add the four models, related enum types, relations, indexes, and constraints to Prisma without applying a database change.
3. Verify the reconciled Prisma schema against Preview.
4. Record the approved baseline and migration policy in `docs/DAILY_LOG.md`.
5. Only then create a dedicated migration branch if a real database change is required.

## Guardrails

- Do not run blanket Prisma deployment migrations.
- Do not apply a database change to `main` during the rebuild freeze.
- Do not delete historical Neon branches until their provenance is recorded.
- Do not expose database credentials, connection strings, or production records in documentation.
