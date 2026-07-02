-- Client Servicing Health only.
-- Intentionally excludes commission-ledger, payout, and finance tables.
-- Apply after Lead MVP through the controlled Neon safety-branch process.

CREATE TYPE "ClientAccountStatus" AS ENUM (
  'PENDING_LAUNCH',
  'ACTIVE',
  'PAYMENT_FAILED',
  'AT_RISK',
  'HOUSE',
  'OFFBOARDED'
);

CREATE TYPE "ClientHealthStatus" AS ENUM (
  'HEALTHY',
  'PAYMENT_FAILED',
  'NEEDS_ATTENTION',
  'AT_RISK'
);

CREATE TYPE "ClientServiceTrigger" AS ENUM (
  'CLIENT_REQUEST',
  'SUPPORT_ISSUE',
  'PAYMENT_PROBLEM',
  'RENEWAL_EVENT',
  'ESCALATION',
  'MANUAL_REVIEW'
);

CREATE TYPE "ClientServicePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

CREATE TYPE "ClientServiceCaseStatus" AS ENUM (
  'OPEN',
  'IN_PROGRESS',
  'WAITING_ON_CLIENT',
  'RESOLVED',
  'CANCELLED'
);

CREATE TYPE "ClientServiceActivityType" AS ENUM (
  'ACCOUNT_CREATED',
  'LAUNCH_COMPLETED',
  'CLIENT_REQUEST',
  'SUPPORT_RESPONSE',
  'PAYMENT_ISSUE',
  'PAYMENT_RESOLVED',
  'RENEWAL_EVENT',
  'ESCALATION',
  'RESOLUTION',
  'HEALTH_CONFIRMATION',
  'OWNERSHIP_RETAINED',
  'HOUSE_TRANSFER'
);

CREATE TYPE "ClientServiceTransferReason" AS ENUM (
  'AGENT_CONTINUES_SERVICE',
  'AGENT_DECLINES_SERVICE',
  'RETIRED',
  'TERMINATED',
  'MANAGER_REASSIGNMENT',
  'HOUSE_REVIEW'
);

CREATE TABLE "ClientAccount" (
  "id" TEXT NOT NULL,
  "leadId" TEXT,
  "clientName" TEXT NOT NULL,
  "ghlLocationId" TEXT,
  "ghlContactId" TEXT,
  "packageCode" TEXT NOT NULL,
  "accountOwnerAgentId" TEXT,
  "originatingAgentId" TEXT,
  "status" "ClientAccountStatus" NOT NULL DEFAULT 'PENDING_LAUNCH',
  "healthStatus" "ClientHealthStatus" NOT NULL DEFAULT 'HEALTHY',
  "currentOnPayments" BOOLEAN NOT NULL DEFAULT true,
  "lastSuccessfulPaymentAt" TIMESTAMP(3),
  "lastPaymentIssueAt" TIMESTAMP(3),
  "nextRenewalAt" TIMESTAMP(3),
  "lastClientRequestAt" TIMESTAMP(3),
  "lastSupportResponseAt" TIMESTAMP(3),
  "lastEscalationAt" TIMESTAMP(3),
  "lastResolvedAt" TIMESTAMP(3),
  "needsAttentionAt" TIMESTAMP(3),
  "launchChecklistComplete" BOOLEAN NOT NULL DEFAULT false,
  "launchCompletedAt" TIMESTAMP(3),
  "houseTransferredAt" TIMESTAMP(3),
  "houseTransferReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientServiceCase" (
  "id" TEXT NOT NULL,
  "clientAccountId" TEXT NOT NULL,
  "assignedAgentId" TEXT,
  "trigger" "ClientServiceTrigger" NOT NULL,
  "priority" "ClientServicePriority" NOT NULL DEFAULT 'NORMAL',
  "status" "ClientServiceCaseStatus" NOT NULL DEFAULT 'OPEN',
  "summary" TEXT NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "resolutionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientServiceCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientServiceActivity" (
  "id" TEXT NOT NULL,
  "clientAccountId" TEXT NOT NULL,
  "serviceCaseId" TEXT,
  "agentId" TEXT,
  "type" "ClientServiceActivityType" NOT NULL,
  "notes" TEXT,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientServiceActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientServiceAssignmentEvent" (
  "id" TEXT NOT NULL,
  "clientAccountId" TEXT NOT NULL,
  "fromAgentId" TEXT,
  "toAgentId" TEXT,
  "reason" "ClientServiceTransferReason" NOT NULL,
  "note" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientServiceAssignmentEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ClientAccount" ADD CONSTRAINT "ClientAccount_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientAccount" ADD CONSTRAINT "ClientAccount_accountOwnerAgentId_fkey" FOREIGN KEY ("accountOwnerAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientAccount" ADD CONSTRAINT "ClientAccount_originatingAgentId_fkey" FOREIGN KEY ("originatingAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientServiceCase" ADD CONSTRAINT "ClientServiceCase_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientServiceCase" ADD CONSTRAINT "ClientServiceCase_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientServiceActivity" ADD CONSTRAINT "ClientServiceActivity_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientServiceActivity" ADD CONSTRAINT "ClientServiceActivity_serviceCaseId_fkey" FOREIGN KEY ("serviceCaseId") REFERENCES "ClientServiceCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientServiceActivity" ADD CONSTRAINT "ClientServiceActivity_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientServiceAssignmentEvent" ADD CONSTRAINT "ClientServiceAssignmentEvent_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientServiceAssignmentEvent" ADD CONSTRAINT "ClientServiceAssignmentEvent_fromAgentId_fkey" FOREIGN KEY ("fromAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientServiceAssignmentEvent" ADD CONSTRAINT "ClientServiceAssignmentEvent_toAgentId_fkey" FOREIGN KEY ("toAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientServiceAssignmentEvent" ADD CONSTRAINT "ClientServiceAssignmentEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ClientAccount_ghlLocationId_key" ON "ClientAccount"("ghlLocationId");
CREATE INDEX "ClientAccount_accountOwnerAgentId_status_idx" ON "ClientAccount"("accountOwnerAgentId", "status");
CREATE INDEX "ClientAccount_healthStatus_idx" ON "ClientAccount"("healthStatus");
CREATE INDEX "ClientAccount_nextRenewalAt_idx" ON "ClientAccount"("nextRenewalAt");
CREATE INDEX "ClientAccount_needsAttentionAt_idx" ON "ClientAccount"("needsAttentionAt");
CREATE INDEX "ClientServiceCase_clientAccountId_status_idx" ON "ClientServiceCase"("clientAccountId", "status");
CREATE INDEX "ClientServiceCase_assignedAgentId_status_dueAt_idx" ON "ClientServiceCase"("assignedAgentId", "status", "dueAt");
CREATE INDEX "ClientServiceCase_priority_status_idx" ON "ClientServiceCase"("priority", "status");
CREATE INDEX "ClientServiceActivity_clientAccountId_occurredAt_idx" ON "ClientServiceActivity"("clientAccountId", "occurredAt");
CREATE INDEX "ClientServiceActivity_serviceCaseId_occurredAt_idx" ON "ClientServiceActivity"("serviceCaseId", "occurredAt");
CREATE INDEX "ClientServiceAssignmentEvent_clientAccountId_createdAt_idx" ON "ClientServiceAssignmentEvent"("clientAccountId", "createdAt");
