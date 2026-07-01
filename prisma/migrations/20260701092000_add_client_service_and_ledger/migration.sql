-- Client accounts, servicing history, commission ledger, and payout references.
-- Apply only after the lead engine migrations in the controlled Neon migration process.

CREATE TYPE "ClientAccountStatus" AS ENUM ('PENDING_LAUNCH','ACTIVE','PAYMENT_FAILED','AT_RISK','HOUSE','OFFBOARDED');
CREATE TYPE "ClientHealthStatus" AS ENUM ('HEALTHY','PAYMENT_FAILED','NEEDS_ATTENTION','AT_RISK');
CREATE TYPE "ClientServiceCadence" AS ENUM ('WEEKLY','BIWEEKLY','MONTHLY');
CREATE TYPE "ClientServiceActivityType" AS ENUM ('MEETING','OFFERED','CLIENT_DECLINED','RESCHEDULED','SUPPORT_REQUEST','SUPPORT_RESPONSE','ESCALATION','HEALTH_CONFIRMATION');
CREATE TYPE "ServiceViolationStatus" AS ENUM ('NONE','WARNING','HOUSE_TRANSFER','TERMINATION_REVIEW');
CREATE TYPE "CommissionEntryType" AS ENUM ('RECURRING','SETUP_FEE','REFUND_OFFSET','CHARGEBACK_HOLD');
CREATE TYPE "CommissionEntryStatus" AS ENUM ('PENDING','ON_HOLD','APPROVED','PAYOUT_READY','PAID','VOIDED');
CREATE TYPE "ContractType" AS ENUM ('SETUP','MONTHLY_RECURRING','NEW_CONTRACT','RENEWAL');
CREATE TYPE "PayoutBatchStatus" AS ENUM ('DRAFT','APPROVED','PROCESSING','PAID','FAILED','CANCELLED');

CREATE TABLE "ClientAccount" (
  "id" TEXT NOT NULL,
  "leadId" TEXT,
  "ghlLocationId" TEXT,
  "ghlContactId" TEXT,
  "packageCode" TEXT NOT NULL,
  "setPricingTier" TEXT,
  "accountOwnerAgentId" TEXT,
  "originatingAgentId" TEXT,
  "status" "ClientAccountStatus" NOT NULL DEFAULT 'PENDING_LAUNCH',
  "healthStatus" "ClientHealthStatus" NOT NULL DEFAULT 'HEALTHY',
  "serviceCadence" "ClientServiceCadence" NOT NULL,
  "serviceGuaranteedMinutes" INTEGER NOT NULL DEFAULT 0,
  "servicePreference" "ClientServiceCadence",
  "lastSuccessfulPaymentAt" TIMESTAMP(3),
  "lastConfirmedHealthAt" TIMESTAMP(3),
  "nextServiceDueAt" TIMESTAMP(3),
  "violationStatus" "ServiceViolationStatus" NOT NULL DEFAULT 'NONE',
  "violationWindowStartAt" TIMESTAMP(3),
  "launchChecklistComplete" BOOLEAN NOT NULL DEFAULT false,
  "launchCompletedAt" TIMESTAMP(3),
  "houseTransferredAt" TIMESTAMP(3),
  "houseTransferReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientServiceActivity" (
  "id" TEXT NOT NULL,
  "clientAccountId" TEXT NOT NULL,
  "agentId" TEXT,
  "type" "ClientServiceActivityType" NOT NULL,
  "offeredAt" TIMESTAMP(3),
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" TIMESTAMP(3),
  "clientDeclined" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientServiceActivity_pkey" PRIMARY KEY ("id")
);

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

ALTER TABLE "ClientAccount" ADD CONSTRAINT "ClientAccount_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientAccount" ADD CONSTRAINT "ClientAccount_accountOwnerAgentId_fkey" FOREIGN KEY ("accountOwnerAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientAccount" ADD CONSTRAINT "ClientAccount_originatingAgentId_fkey" FOREIGN KEY ("originatingAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientServiceActivity" ADD CONSTRAINT "ClientServiceActivity_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientServiceActivity" ADD CONSTRAINT "ClientServiceActivity_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommissionLedgerEntry" ADD CONSTRAINT "CommissionLedgerEntry_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommissionLedgerEntry" ADD CONSTRAINT "CommissionLedgerEntry_earningAgentId_fkey" FOREIGN KEY ("earningAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommissionLedgerEntry" ADD CONSTRAINT "CommissionLedgerEntry_originatingAgentId_fkey" FOREIGN KEY ("originatingAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommissionLedgerEntry" ADD CONSTRAINT "CommissionLedgerEntry_payoutBatchId_fkey" FOREIGN KEY ("payoutBatchId") REFERENCES "PayoutBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayoutDestination" ADD CONSTRAINT "PayoutDestination_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayoutLine" ADD CONSTRAINT "PayoutLine_payoutBatchId_fkey" FOREIGN KEY ("payoutBatchId") REFERENCES "PayoutBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayoutLine" ADD CONSTRAINT "PayoutLine_commissionLedgerId_fkey" FOREIGN KEY ("commissionLedgerId") REFERENCES "CommissionLedgerEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayoutLine" ADD CONSTRAINT "PayoutLine_destinationAgentId_fkey" FOREIGN KEY ("destinationAgentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ClientAccount_ghlLocationId_key" ON "ClientAccount"("ghlLocationId");
CREATE INDEX "ClientAccount_accountOwnerAgentId_status_idx" ON "ClientAccount"("accountOwnerAgentId", "status");
CREATE INDEX "ClientAccount_nextServiceDueAt_idx" ON "ClientAccount"("nextServiceDueAt");
CREATE INDEX "ClientAccount_healthStatus_idx" ON "ClientAccount"("healthStatus");
CREATE INDEX "ClientServiceActivity_clientAccountId_occurredAt_idx" ON "ClientServiceActivity"("clientAccountId", "occurredAt");
CREATE INDEX "ClientServiceActivity_agentId_dueAt_idx" ON "ClientServiceActivity"("agentId", "dueAt");
CREATE INDEX "CommissionLedgerEntry_clientAccountId_status_idx" ON "CommissionLedgerEntry"("clientAccountId", "status");
CREATE INDEX "CommissionLedgerEntry_earningAgentId_status_idx" ON "CommissionLedgerEntry"("earningAgentId", "status");
CREATE INDEX "CommissionLedgerEntry_eligibleAt_idx" ON "CommissionLedgerEntry"("eligibleAt");
CREATE INDEX "PayoutBatch_status_createdAt_idx" ON "PayoutBatch"("status", "createdAt");
CREATE INDEX "PayoutLine_payoutBatchId_idx" ON "PayoutLine"("payoutBatchId");
CREATE INDEX "PayoutLine_destinationAgentId_idx" ON "PayoutLine"("destinationAgentId");
