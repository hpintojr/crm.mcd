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

## Source-Schema Alignment

The active `prisma/schema.prisma` represents authentication, agent onboarding, appointments, leads, webhook events, integration errors, and audit logs.

The following Preview tables are **not** represented in that Prisma schema:

| Database table | Role in the operating model |
|---|---|
| `ClientAccount` | Client ownership, payment/health state, launch status, and House-transfer record |
| `ClientServiceActivity` | Triggered servicing history and documented responses |
| `ClientServiceAssignmentEvent` | Auditable servicing-assignment changes |
| `ClientServiceCase` | Client requests, payment issues, renewals, escalations, and resolution work |

This is schema drift. The database includes the servicing model required by policy, but the active source schema cannot safely query or evolve it through Prisma.

## Historical Migration Record

The database migration ledger records:

| ID | Description | Applied |
|---|---|---|
| `20260702_000_production_baseline` | Production baseline before Lead MVP rollout | 2026-07-02 |
| `20260702_001_lead_mvp` | Lead MVP schema rollout | 2026-07-02 |

The migration record does not by itself establish source-of-truth ownership for the client-servicing tables.

## Required Reconciliation Gate

Before any new migration or client-servicing implementation:

1. Treat the inspected Preview branch as the factual database inventory.
2. Identify the approved source schema for the four client-servicing tables and their related enum types, indexes, and constraints.
3. Reconcile source code and Prisma schema in a no-migration branch first.
4. Verify the reconciled schema against the Preview database.
5. Record the approved baseline and migration policy in `docs/DAILY_LOG.md`.
6. Only then create a dedicated migration branch if a real database change is required.

## Guardrails

- Do not run blanket Prisma deployment migrations.
- Do not apply a database change to `main` during the rebuild freeze.
- Do not delete historical Neon branches until their provenance is recorded.
- Do not expose database credentials, connection strings, or production records in documentation.
