-- Mercury Call Desk Mini CRM
-- Migration: 20260702_000_production_baseline
-- Purpose: establish an auditable database-migration ledger without changing
-- existing application tables or business data.
--
-- Run with the direct Neon connection string, never the pooled runtime URL.
-- This file is intentionally idempotent.

CREATE TABLE IF NOT EXISTS "_mcd_schema_migrations" (
  "id" TEXT PRIMARY KEY,
  "description" TEXT NOT NULL,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "appliedBy" TEXT,
  "gitSha" TEXT,
  "notes" TEXT
);

INSERT INTO "_mcd_schema_migrations" ("id", "description", "notes")
VALUES (
  '20260702_000_production_baseline',
  'Production baseline before Lead MVP rollout',
  'Core onboarding, auth, appointment, webhook, integration-error, and audit tables existed before the migration ledger was introduced.'
)
ON CONFLICT ("id") DO NOTHING;
