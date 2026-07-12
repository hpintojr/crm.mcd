-- Commission ledger, commission review controls, and payout references.
--
-- CORRECTED 2026-07-12 (follow-up to PR #99): PR #99 correctly removed the
-- Client/Service objects already present in production, but the remaining Commission
-- schema still used obsolete enum names, status values, and money columns and omitted
-- CommissionHold, CommissionEligibilityDecision, and AgentCommissionProfile entirely.
--
-- The statements below match the raw SQL used by:
--   src/lib/commission-ledger-actions.ts
--   src/lib/commission-read-model.ts
--   src/lib/commission-review-actions.ts
--   src/lib/commission-hold-release.ts
--   src/lib/commission-ledger-policy.ts
--   src/lib/commission-policy.ts
--
-- This exact statement set was tested end to end on Neon project jolly-lab-80341970,
-- disposable branch br-little-rain-aj8nppg1
-- (qa/commission-schema-correction-20260712-chatgpt), after resetting it from the
-- production parent. Enum values, columns, defaults, indexes, and foreign keys were
-- verified from the PostgreSQL catalog. App-style profile upsert, eligibility
-- supersession, ledger intake, hold/release, clearance, and payout-link writes all
-- passed with synthetic branch-only data, which was deleted after verification.
--
-- This migration file is not applied by this PR. Running it against production still
-- requires Hamilton's separate explicit authorization per LOCK.md.

CREATE TYPE "CommissionLedgerEntryType" AS ENUM ('RECURRING','SETUP_FEE','REFUND_OFFSET','CHARGEBACK_HOLD','MANUAL_ADJUSTMENT');
CREATE TYPE "CommissionLedgerEntryStatus" AS ENUM ('PENDING_VERIFICATION','ON_HOLD','ELIGIBLE');
CREATE TYPE "CommissionHoldReason" AS ENUM ('PAYMENT_UNCLEARED','REFUND','CHARGEBACK','MANUAL_REVIEW','COMPLIANCE_REVIEW','SERVICE_OWNERSHIP','TERMINATED');
CREATE TYPE "CommissionEligibilityStatus" AS ENUM ('PENDING','ELIGIBLE','ON_HOLD','INELIGIBLE');
CREATE TYPE "CommissionEligibilityReason" AS ENUM ('ACTIVE_SERVICE','RETIRED','AGENT_DECLINES_SERVICE','HOUSE_TRANSFER','TERMINATED','PAYMENT_UNCLEARED','MANUAL_HOLD','MISSING_SERVICE_OWNER','MANUAL_REVIEW');
CREATE TYPE "CommissionProfileStatus" AS ENUM ('ACTIVE','RETIRED','TERMINATED','ON_HOLD');
CREATE TYPE "PayoutBatchStatus" AS ENUM ('DRAFT','APPROVED','PROCESSING','PAID','FAILED','CANCELLED');

CREATE TABLE "PayoutBatch" (
  "id" TEXT NOT NULL,
  "status" "PayoutBatchStatus" NOT NULL DEFAULT 'DRAFT',
  "totalCents" INTEGER NOT NULL DEFAULT 0,
  "itemCount" INTEGER NOT NULL DEFAULT 0,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "providerReference" TEXT,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayoutBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommissionLedgerEntry" (
  "id" TEXT NOT NULL,
  "clientAccountId" TEXT,
  "paymentRef" TEXT NOT NULL,
  "paymentOccurredAt" TIMESTAMP(3) NOT NULL,
  "entryType" "CommissionLedgerEntryType" NOT NULL,
  "status" "CommissionLedgerEntryStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "packageCode" TEXT NOT NULL,
  "earningAgentId" TEXT,
  "originatingAgentId" TEXT,
  "grossCollectedCents" INTEGER NOT NULL,
  "refundOffsetCents" INTEGER NOT NULL DEFAULT 0,
  "commissionableCents" INTEGER,
  "proposedAgentShareCents" INTEGER,
  "calculationNote" TEXT,
  "createdById" TEXT NOT NULL,
  "clearedAt" TIMESTAMP(3),
  "eligibleAt" TIMESTAMP(3),
  "holdReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommissionLedgerEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommissionLedgerEntry_paymentRef_entryType_key" UNIQUE ("paymentRef", "entryType")
);

CREATE TABLE "CommissionHold" (
  "id" TEXT NOT NULL,
  "ledgerEntryId" TEXT,
  "clientAccountId" TEXT,
  "agentId" TEXT,
  "reason" "CommissionHoldReason" NOT NULL,
  "note" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "appliedById" TEXT NOT NULL,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedById" TEXT,
  "releasedAt" TIMESTAMP(3),
  "releaseNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommissionHold_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommissionEligibilityDecision" (
  "id" TEXT NOT NULL,
  "clientAccountId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "status" "CommissionEligibilityStatus" NOT NULL,
  "reason" "CommissionEligibilityReason" NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL,
  "reviewNote" TEXT,
  "recordedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "supersededAt" TIMESTAMP(3),
  CONSTRAINT "CommissionEligibilityDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentCommissionProfile" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "status" "CommissionProfileStatus" NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL,
  "retiredAt" TIMESTAMP(3),
  "terminatedAt" TIMESTAMP(3),
  "holdReason" TEXT,
  "reviewNote" TEXT,
  "lastReviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentCommissionProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AgentCommissionProfile_agentId_key" UNIQUE ("agentId")
);

CREATE TABLE "PayoutDestination" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'stripe',
  "connectedAccountId" TEXT,
  "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
  "lastCheckedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayoutDestination_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PayoutDestination_agentId_key" UNIQUE ("agentId"),
  CONSTRAINT "PayoutDestination_connectedAccountId_key" UNIQUE ("connectedAccountId")
);

CREATE TABLE "PayoutLine" (
  "id" TEXT NOT NULL,
  "payoutBatchId" TEXT,
  "commissionLedgerId" TEXT NOT NULL,
  "destinationAgentId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "providerReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayoutLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PayoutLine_commissionLedgerId_key" UNIQUE ("commissionLedgerId")
);

ALTER TABLE "CommissionLedgerEntry" ADD CONSTRAINT "CommissionLedgerEntry_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommissionLedgerEntry" ADD CONSTRAINT "CommissionLedgerEntry_earningAgentId_fkey" FOREIGN KEY ("earningAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommissionLedgerEntry" ADD CONSTRAINT "CommissionLedgerEntry_originatingAgentId_fkey" FOREIGN KEY ("originatingAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommissionHold" ADD CONSTRAINT "CommissionHold_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "CommissionLedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommissionHold" ADD CONSTRAINT "CommissionHold_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommissionHold" ADD CONSTRAINT "CommissionHold_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommissionEligibilityDecision" ADD CONSTRAINT "CommissionEligibilityDecision_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionEligibilityDecision" ADD CONSTRAINT "CommissionEligibilityDecision_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentCommissionProfile" ADD CONSTRAINT "AgentCommissionProfile_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayoutDestination" ADD CONSTRAINT "PayoutDestination_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayoutLine" ADD CONSTRAINT "PayoutLine_payoutBatchId_fkey" FOREIGN KEY ("payoutBatchId") REFERENCES "PayoutBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayoutLine" ADD CONSTRAINT "PayoutLine_commissionLedgerId_fkey" FOREIGN KEY ("commissionLedgerId") REFERENCES "CommissionLedgerEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayoutLine" ADD CONSTRAINT "PayoutLine_destinationAgentId_fkey" FOREIGN KEY ("destinationAgentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "CommissionLedgerEntry_clientAccountId_status_idx" ON "CommissionLedgerEntry"("clientAccountId", "status");
CREATE INDEX "CommissionLedgerEntry_earningAgentId_status_idx" ON "CommissionLedgerEntry"("earningAgentId", "status");
CREATE INDEX "CommissionLedgerEntry_eligibleAt_idx" ON "CommissionLedgerEntry"("eligibleAt");
CREATE INDEX "CommissionHold_ledgerEntryId_active_idx" ON "CommissionHold"("ledgerEntryId", "active");
CREATE INDEX "CommissionHold_clientAccountId_active_idx" ON "CommissionHold"("clientAccountId", "active");
CREATE INDEX "CommissionHold_agentId_active_idx" ON "CommissionHold"("agentId", "active");
CREATE INDEX "CommissionHold_active_appliedAt_idx" ON "CommissionHold"("active", "appliedAt");
CREATE INDEX "CommissionEligibilityDecision_client_agent_effective_idx" ON "CommissionEligibilityDecision"("clientAccountId", "agentId", "effectiveAt");
CREATE UNIQUE INDEX "CommissionEligibilityDecision_current_key" ON "CommissionEligibilityDecision"("clientAccountId", "agentId") WHERE "supersededAt" IS NULL;
CREATE INDEX "CommissionEligibilityDecision_agentId_status_idx" ON "CommissionEligibilityDecision"("agentId", "status");
CREATE INDEX "AgentCommissionProfile_status_idx" ON "AgentCommissionProfile"("status");
CREATE INDEX "PayoutBatch_status_createdAt_idx" ON "PayoutBatch"("status", "createdAt");
CREATE INDEX "PayoutLine_payoutBatchId_idx" ON "PayoutLine"("payoutBatchId");
CREATE INDEX "PayoutLine_destinationAgentId_idx" ON "PayoutLine"("destinationAgentId");
