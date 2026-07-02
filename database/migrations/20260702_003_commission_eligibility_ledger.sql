-- Commission Eligibility & Ledger only.
-- Intentionally excludes payout batches, payout destinations, payout provider integrations, and fund movement.
-- Apply only after the Client Servicing Health migration through the controlled Neon safety-branch process.

CREATE TYPE "CommissionProfileStatus" AS ENUM ('ACTIVE','RETIRED','TERMINATED','ON_HOLD');
CREATE TYPE "CommissionEligibilityStatus" AS ENUM ('PENDING','ELIGIBLE','ON_HOLD','INELIGIBLE');
CREATE TYPE "CommissionEligibilityReason" AS ENUM ('ACTIVE_SERVICE','RETIRED','AGENT_DECLINES_SERVICE','HOUSE_TRANSFER','TERMINATED','PAYMENT_UNCLEARED','REFUND','CHARGEBACK','MANUAL_HOLD','MISSING_SERVICE_OWNER','MANUAL_REVIEW');
CREATE TYPE "CommissionLedgerEntryType" AS ENUM ('RECURRING','SETUP_FEE','REFUND_OFFSET','CHARGEBACK_HOLD','MANUAL_ADJUSTMENT');
CREATE TYPE "CommissionLedgerEntryStatus" AS ENUM ('PENDING_VERIFICATION','ON_HOLD','ELIGIBLE','READY_FOR_FINANCE_REVIEW','VOIDED');
CREATE TYPE "CommissionHoldReason" AS ENUM ('PAYMENT_UNCLEARED','REFUND','CHARGEBACK','MANUAL_REVIEW','COMPLIANCE_REVIEW','SERVICE_OWNERSHIP','TERMINATED');

CREATE TABLE "AgentCommissionProfile" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "status" "CommissionProfileStatus" NOT NULL DEFAULT 'ACTIVE',
  "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

CREATE TABLE "CommissionEligibilityDecision" (
  "id" TEXT NOT NULL,
  "clientAccountId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "status" "CommissionEligibilityStatus" NOT NULL DEFAULT 'PENDING',
  "reason" "CommissionEligibilityReason" NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewNote" TEXT,
  "recordedById" TEXT,
  "supersededAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommissionEligibilityDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommissionLedgerEntry" (
  "id" TEXT NOT NULL,
  "clientAccountId" TEXT,
  "eligibilityDecisionId" TEXT,
  "paymentRef" TEXT NOT NULL,
  "paymentOccurredAt" TIMESTAMP(3) NOT NULL,
  "clearedAt" TIMESTAMP(3),
  "entryType" "CommissionLedgerEntryType" NOT NULL,
  "status" "CommissionLedgerEntryStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "packageCode" TEXT,
  "earningAgentId" TEXT,
  "originatingAgentId" TEXT,
  "grossCollectedCents" INTEGER NOT NULL,
  "refundOffsetCents" INTEGER NOT NULL DEFAULT 0,
  "commissionableCents" INTEGER,
  "proposedAgentShareCents" INTEGER,
  "calculationNote" TEXT,
  "sourceMetadata" JSONB,
  "eligibleAt" TIMESTAMP(3),
  "holdReason" TEXT,
  "createdById" TEXT,
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
  "appliedById" TEXT,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedById" TEXT,
  "releasedAt" TIMESTAMP(3),
  "releaseNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommissionHold_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AgentCommissionProfile" ADD CONSTRAINT "AgentCommissionProfile_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommissionEligibilityDecision" ADD CONSTRAINT "CommissionEligibilityDecision_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommissionEligibilityDecision" ADD CONSTRAINT "CommissionEligibilityDecision_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionEligibilityDecision" ADD CONSTRAINT "CommissionEligibilityDecision_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommissionLedgerEntry" ADD CONSTRAINT "CommissionLedgerEntry_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommissionLedgerEntry" ADD CONSTRAINT "CommissionLedgerEntry_eligibilityDecisionId_fkey" FOREIGN KEY ("eligibilityDecisionId") REFERENCES "CommissionEligibilityDecision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommissionLedgerEntry" ADD CONSTRAINT "CommissionLedgerEntry_earningAgentId_fkey" FOREIGN KEY ("earningAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommissionLedgerEntry" ADD CONSTRAINT "CommissionLedgerEntry_originatingAgentId_fkey" FOREIGN KEY ("originatingAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommissionLedgerEntry" ADD CONSTRAINT "CommissionLedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommissionHold" ADD CONSTRAINT "CommissionHold_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "CommissionLedgerEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommissionHold" ADD CONSTRAINT "CommissionHold_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommissionHold" ADD CONSTRAINT "CommissionHold_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommissionHold" ADD CONSTRAINT "CommissionHold_appliedById_fkey" FOREIGN KEY ("appliedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommissionHold" ADD CONSTRAINT "CommissionHold_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AgentCommissionProfile_status_idx" ON "AgentCommissionProfile"("status");
CREATE INDEX "CommissionEligibilityDecision_clientAccountId_effectiveAt_idx" ON "CommissionEligibilityDecision"("clientAccountId", "effectiveAt");
CREATE INDEX "CommissionEligibilityDecision_agentId_status_idx" ON "CommissionEligibilityDecision"("agentId", "status");
CREATE INDEX "CommissionLedgerEntry_clientAccountId_status_idx" ON "CommissionLedgerEntry"("clientAccountId", "status");
CREATE INDEX "CommissionLedgerEntry_earningAgentId_status_idx" ON "CommissionLedgerEntry"("earningAgentId", "status");
CREATE INDEX "CommissionLedgerEntry_eligibleAt_idx" ON "CommissionLedgerEntry"("eligibleAt");
CREATE INDEX "CommissionHold_active_idx" ON "CommissionHold"("active");
CREATE INDEX "CommissionHold_ledgerEntryId_active_idx" ON "CommissionHold"("ledgerEntryId", "active");
CREATE INDEX "CommissionHold_clientAccountId_active_idx" ON "CommissionHold"("clientAccountId", "active");
