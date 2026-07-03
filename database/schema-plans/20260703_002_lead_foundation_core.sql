-- PROPOSAL ONLY — DO NOT APPLY TO PRODUCTION.
-- Database authority: public._mcd_schema_migrations.
-- Target rehearsal branch: lead-foundation-contract-v1.
-- This plan is additive except for allowing Lead.businessPhone to be null.

BEGIN;

DO $$ BEGIN
  CREATE TYPE "LeadContactType" AS ENUM ('PRIMARY', 'DECISION_MAKER', 'OPERATIONAL', 'BILLING', 'GENERAL', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeadContactStatus" AS ENUM ('ACTIVE', 'INVALID', 'SUPPRESSED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeadImportKeyStatus" AS ENUM ('ACTIVE', 'REVOKED', 'RETIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeadImportBatchStatus" AS ENUM ('DRAFT', 'ROWS_RECEIVED', 'PREVIEWED', 'REVIEW_REQUIRED', 'APPROVED_FOR_SUBMISSION', 'SUBMITTED', 'PARTIALLY_ACCEPTED', 'COMPLETED', 'FAILED', 'RECONCILIATION_REQUIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeadImportRecordStatus" AS ENUM ('RECEIVED', 'VALID', 'DUPLICATE_IN_BATCH', 'POSSIBLE_EXISTING_DUPLICATE', 'SUPPRESSED', 'REVIEW_REQUIRED', 'REJECTED', 'PENDING_ADMIN_REVIEW', 'APPROVED', 'IMPORTED', 'IMPORT_ERROR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeadImportRequestStatus" AS ENUM ('RECEIVED', 'COMPLETED', 'REJECTED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Lead" ALTER COLUMN "businessPhone" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS "LeadContact" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "contactType" "LeadContactType" NOT NULL DEFAULT 'GENERAL',
  "firstName" TEXT,
  "lastName" TEXT,
  "email" TEXT,
  "normalizedEmail" TEXT,
  "businessPhone" TEXT,
  "normalizedPhone" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "status" "LeadContactStatus" NOT NULL DEFAULT 'ACTIVE',
  "sourceRecordReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadContact_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeadContact_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "LeadImportKey" (
  "id" TEXT NOT NULL,
  "keyId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "status" "LeadImportKeyStatus" NOT NULL DEFAULT 'ACTIVE',
  "secretFingerprint" TEXT,
  "revokedAt" TIMESTAMP(3),
  "retiredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadImportKey_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeadImportKey_keyId_key" UNIQUE ("keyId")
);

CREATE TABLE IF NOT EXISTS "LeadImportBatch" (
  "id" TEXT NOT NULL,
  "keyId" TEXT NOT NULL,
  "localRunId" TEXT NOT NULL,
  "operatorName" TEXT NOT NULL,
  "sourceAdapter" TEXT NOT NULL,
  "sourceAdapterVersion" TEXT NOT NULL,
  "manifestHash" TEXT NOT NULL,
  "clientVersion" TEXT NOT NULL,
  "status" "LeadImportBatchStatus" NOT NULL DEFAULT 'DRAFT',
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "validRows" INTEGER NOT NULL DEFAULT 0,
  "rejectedRows" INTEGER NOT NULL DEFAULT 0,
  "importedRows" INTEGER NOT NULL DEFAULT 0,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "approvalReference" TEXT,
  "submittedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadImportBatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeadImportBatch_keyId_localRunId_key" UNIQUE ("keyId", "localRunId"),
  CONSTRAINT "LeadImportBatch_keyId_fkey" FOREIGN KEY ("keyId") REFERENCES "LeadImportKey"("keyId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LeadImportBatch_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "LeadImportRecord" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "rowHash" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" "LeadImportRecordStatus" NOT NULL DEFAULT 'RECEIVED',
  "inputSnapshot" JSONB NOT NULL,
  "normalizedSnapshot" JSONB,
  "issues" JSONB,
  "resolvedLeadId" TEXT,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "importedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadImportRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeadImportRecord_batchId_rowNumber_key" UNIQUE ("batchId", "rowNumber"),
  CONSTRAINT "LeadImportRecord_idempotencyKey_key" UNIQUE ("idempotencyKey"),
  CONSTRAINT "LeadImportRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "LeadImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LeadImportRecord_resolvedLeadId_fkey" FOREIGN KEY ("resolvedLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "LeadImportRecord_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "LeadImportRequest" (
  "id" TEXT NOT NULL,
  "keyId" TEXT NOT NULL,
  "batchId" TEXT,
  "method" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "signedTimestampMs" BIGINT NOT NULL,
  "bodySha256" TEXT NOT NULL,
  "signature" TEXT NOT NULL,
  "requestIdempotencyKey" TEXT,
  "status" "LeadImportRequestStatus" NOT NULL DEFAULT 'RECEIVED',
  "responseStatusCode" INTEGER,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadImportRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeadImportRequest_keyId_signature_key" UNIQUE ("keyId", "signature"),
  CONSTRAINT "LeadImportRequest_keyId_fkey" FOREIGN KEY ("keyId") REFERENCES "LeadImportKey"("keyId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LeadImportRequest_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "LeadImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "LeadContact_leadId_isPrimary_idx" ON "LeadContact"("leadId", "isPrimary");
CREATE INDEX IF NOT EXISTS "LeadContact_normalizedEmail_idx" ON "LeadContact"("normalizedEmail");
CREATE INDEX IF NOT EXISTS "LeadContact_normalizedPhone_idx" ON "LeadContact"("normalizedPhone");
CREATE INDEX IF NOT EXISTS "LeadContact_status_idx" ON "LeadContact"("status");
CREATE INDEX IF NOT EXISTS "LeadImportKey_status_idx" ON "LeadImportKey"("status");
CREATE INDEX IF NOT EXISTS "LeadImportBatch_status_createdAt_idx" ON "LeadImportBatch"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "LeadImportBatch_approvedByUserId_idx" ON "LeadImportBatch"("approvedByUserId");
CREATE INDEX IF NOT EXISTS "LeadImportRecord_status_createdAt_idx" ON "LeadImportRecord"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "LeadImportRecord_resolvedLeadId_idx" ON "LeadImportRecord"("resolvedLeadId");
CREATE INDEX IF NOT EXISTS "LeadImportRecord_reviewedByUserId_idx" ON "LeadImportRecord"("reviewedByUserId");
CREATE INDEX IF NOT EXISTS "LeadImportRequest_expiresAt_idx" ON "LeadImportRequest"("expiresAt");
CREATE INDEX IF NOT EXISTS "LeadImportRequest_batchId_createdAt_idx" ON "LeadImportRequest"("batchId", "createdAt");

INSERT INTO "_mcd_schema_migrations" ("id", "description", "notes")
VALUES (
  '20260703_002_lead_foundation_core',
  'Lead contacts and durable signed-import records',
  'Approved schema plan; apply only after isolated-branch validation and recovery acceptance.'
)
ON CONFLICT ("id") DO NOTHING;

COMMIT;
