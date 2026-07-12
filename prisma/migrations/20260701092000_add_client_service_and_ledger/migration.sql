-- Commission ledger and payout references.
--
-- CORRECTED 2026-07-12: this migration originally also contained Client/Service schema
-- (ClientAccount, ClientServiceActivity + their enums). A Neon safety-branch test
-- (project jolly-lab-80341970, branch br-aged-night-ajbqk1j7, 2026-07-12) confirmed that
-- ClientAccount, ClientServiceActivity, ClientServiceCase, ClientServiceAssignmentEvent, and
-- their supporting enums already exist in production today, applied through a separate,
-- untracked path not reflected in this file or in the `_mcd_schema_migrations` ledger. Running
-- the original file as committed fails immediately on `CREATE TYPE "ClientAccountStatus"`
-- because that type already exists.
--
-- This file has been corrected to contain only the objects confirmed still missing from
-- production: the commission ledger, payout batch, and payout destination/line schema. The
-- statements below were tested end-to-end on the same safety branch on 2026-07-12 (all 22
-- statements applied cleanly; columns, types, and all 8 foreign keys verified afterward).
-- Apply only after review. This file still requires Hamilton's explicit authorization before
-- being run against production, per LOCK.md.

CREATE TYPE "CommissionEntryType" AS ENUM ('RECURRING','SETUP_FEE','REFUND_OFFSET','CHARGEBACK_HOLD');
CREATE TYPE "CommissionEntryStatus" AS ENUM ('PENDING','ON_HOLD','APPROVED','PAYOUT_READY','PAID','VOIDED');
CREATE TYPE "ContractType" AS ENUM ('SETUP','MONTHLY_RECURRING','NEW_CONTRACT','RENEWAL');
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
  "clearedAt" TIMESTAMP(3),
  "entryType" "CommissionEntryType" NOT NULL,
  "status" "CommissionEntryStatus" NOT NULL DEFAULT 'PENDING',
  "contractType" "ContractType" NOT NULL,
  "packageCode" TEXT NOT NULL,
  "earningAgentId" TEXT,
  "originatingAgentId" TEXT,
  "amountCollectedCents" INTEGER NOT NULL,
  "processingFeeCents" INTEGER NOT NULL,
  "taxCents" INTEGER NOT NULL,
  "wholesaleCents" INTEGER NOT NULL,
  "netCommissionableCents" INTEGER NOT NULL,
  "partnerShareCents" INTEGER NOT NULL,
  "mcdShareCents" INTEGER NOT NULL,
  "eligibleAt" TIMESTAMP(3),
  "holdReason" TEXT,
  "financeApprovedById" TEXT,
  "financeApprovedAt" TIMESTAMP(3),
  "payoutBatchId" TEXT,
  "payoutReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommissionLedgerEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommissionLedgerEntry_paymentRef_entryType_key" UNIQUE ("paymentRef", "entryType")
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
ALTER TABLE "CommissionLedgerEntry" ADD CONSTRAINT "CommissionLedgerEntry_payoutBatchId_fkey" FOREIGN KEY ("payoutBatchId") REFERENCES "PayoutBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayoutDestination" ADD CONSTRAINT "PayoutDestination_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayoutLine" ADD CONSTRAINT "PayoutLine_payoutBatchId_fkey" FOREIGN KEY ("payoutBatchId") REFERENCES "PayoutBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayoutLine" ADD CONSTRAINT "PayoutLine_commissionLedgerId_fkey" FOREIGN KEY ("commissionLedgerId") REFERENCES "CommissionLedgerEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayoutLine" ADD CONSTRAINT "PayoutLine_destinationAgentId_fkey" FOREIGN KEY ("destinationAgentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "CommissionLedgerEntry_clientAccountId_status_idx" ON "CommissionLedgerEntry"("clientAccountId", "status");
CREATE INDEX "CommissionLedgerEntry_earningAgentId_status_idx" ON "CommissionLedgerEntry"("earningAgentId", "status");
CREATE INDEX "CommissionLedgerEntry_eligibleAt_idx" ON "CommissionLedgerEntry"("eligibleAt");
CREATE INDEX "PayoutBatch_status_createdAt_idx" ON "PayoutBatch"("status", "createdAt");
CREATE INDEX "PayoutLine_payoutBatchId_idx" ON "PayoutLine"("payoutBatchId");
CREATE INDEX "PayoutLine_destinationAgentId_idx" ON "PayoutLine"("destinationAgentId");
