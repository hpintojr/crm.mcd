-- Lead engine tables and enums.
-- Apply only through the controlled Neon migration process.

CREATE TYPE "LeadLifecycle" AS ENUM ('RAW','PENDING_REVIEW','AVAILABLE','CLAIMED','CONTACTED','NURTURING','DEMO_BOOKED','CLOSED_WON','CLOSED_LOST','DISQUALIFIED','SUPPRESSED');
CREATE TYPE "LeadPool" AS ENUM ('COLD','OPEN','HOT','REFERRAL','SHARK_TANK','HOUSE','NURTURE');
CREATE TYPE "LeadClaimAction" AS ENUM ('CLAIMED','RELEASED','REASSIGNED','RETURNED_TO_POOL','DENIED');
CREATE TYPE "LeadActivityType" AS ENUM ('LEAD_CREATED','LEAD_CLAIMED','LEAD_RELEASED','CALL_INITIATED','CALL_COMPLETED','NOTE_ADDED','DISPOSITION_SET','CALLBACK_SCHEDULED','CALLBACK_COMPLETED','DNC_REQUESTED','DEMO_BOOKED','REASSIGNED');
CREATE TYPE "LeadDisposition" AS ENUM ('NO_ANSWER','VOICEMAIL','CALLBACK_REQUESTED','QUALIFIED','NOT_INTERESTED','DO_NOT_CONTACT','WRONG_NUMBER','OUT_OF_BUSINESS','DEMO_BOOKED','FOLLOW_UP');
CREATE TYPE "LeadCallbackStatus" AS ENUM ('SCHEDULED','COMPLETED','CANCELLED');
CREATE TYPE "SuppressionType" AS ENUM ('DNC','OPT_OUT','INVALID_PHONE','DUPLICATE','COMPLIANCE_HOLD','LEGAL_HOLD');

CREATE TABLE "Lead" (
  "id" TEXT NOT NULL,
  "company" TEXT NOT NULL,
  "contactFirstName" TEXT,
  "contactLastName" TEXT,
  "email" TEXT,
  "businessPhone" TEXT NOT NULL,
  "normalizedPhone" TEXT,
  "website" TEXT,
  "industry" TEXT,
  "city" TEXT,
  "state" TEXT,
  "country" TEXT,
  "timezone" TEXT,
  "source" TEXT,
  "sourceReference" TEXT,
  "score" INTEGER NOT NULL DEFAULT 0,
  "lifecycle" "LeadLifecycle" NOT NULL DEFAULT 'PENDING_REVIEW',
  "pool" "LeadPool" NOT NULL DEFAULT 'COLD',
  "ownerAgentId" TEXT,
  "claimedAt" TIMESTAMP(3),
  "twoWayContactAt" TIMESTAMP(3),
  "lastActionAt" TIMESTAMP(3),
  "nextActionAt" TIMESTAMP(3),
  "openPoolReleaseAt" TIMESTAMP(3),
  "isReferral" BOOLEAN NOT NULL DEFAULT false,
  "referralSource" TEXT,
  "suppressed" BOOLEAN NOT NULL DEFAULT false,
  "dnc" BOOLEAN NOT NULL DEFAULT false,
  "ghlContactId" TEXT,
  "ghlOpportunityId" TEXT,
  "ghlAppointmentId" TEXT,
  "packageInterest" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadClaimEvent" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "agentId" TEXT,
  "action" "LeadClaimAction" NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadClaimEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadActivity" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "agentId" TEXT,
  "type" "LeadActivityType" NOT NULL,
  "disposition" "LeadDisposition",
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadNote" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "agentId" TEXT,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadCallback" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "agentId" TEXT,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "status" "LeadCallbackStatus" NOT NULL DEFAULT 'SCHEDULED',
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadCallback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadSuppression" (
  "id" TEXT NOT NULL,
  "leadId" TEXT,
  "identifier" TEXT NOT NULL,
  "type" "SuppressionType" NOT NULL,
  "reason" TEXT,
  "createdById" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "liftedAt" TIMESTAMP(3),
  CONSTRAINT "LeadSuppression_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Lead_pool_lifecycle_ownerAgentId_idx" ON "Lead"("pool", "lifecycle", "ownerAgentId");
CREATE INDEX "Lead_nextActionAt_idx" ON "Lead"("nextActionAt");
CREATE INDEX "Lead_openPoolReleaseAt_idx" ON "Lead"("openPoolReleaseAt");
CREATE INDEX "Lead_normalizedPhone_idx" ON "Lead"("normalizedPhone");
CREATE INDEX "Lead_ghlContactId_idx" ON "Lead"("ghlContactId");
CREATE INDEX "LeadClaimEvent_leadId_createdAt_idx" ON "LeadClaimEvent"("leadId", "createdAt");
CREATE INDEX "LeadClaimEvent_agentId_createdAt_idx" ON "LeadClaimEvent"("agentId", "createdAt");
CREATE INDEX "LeadActivity_leadId_occurredAt_idx" ON "LeadActivity"("leadId", "occurredAt");
CREATE INDEX "LeadActivity_agentId_occurredAt_idx" ON "LeadActivity"("agentId", "occurredAt");
CREATE INDEX "LeadNote_leadId_createdAt_idx" ON "LeadNote"("leadId", "createdAt");
CREATE INDEX "LeadCallback_agentId_status_dueAt_idx" ON "LeadCallback"("agentId", "status", "dueAt");
CREATE INDEX "LeadCallback_leadId_status_idx" ON "LeadCallback"("leadId", "status");
CREATE INDEX "LeadSuppression_identifier_active_idx" ON "LeadSuppression"("identifier", "active");
CREATE INDEX "LeadSuppression_leadId_active_idx" ON "LeadSuppression"("leadId", "active");
