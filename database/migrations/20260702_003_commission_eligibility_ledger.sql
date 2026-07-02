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
