-- Additive internal activation gate evidence fields on Agent.
-- These record admin-verified proof (official W-9 received via the approved
-- secure intake, profile completeness, CRM training/check-in) required before
-- a provisioning activation email may be issued.
-- Status evidence only: no tax forms, tax identifiers, banking data, or
-- document contents are stored in the MiniCRM.
ALTER TABLE "Agent"
  ADD COLUMN "w9VerifiedAt" TIMESTAMP(3),
  ADD COLUMN "w9VerifiedById" TEXT,
  ADD COLUMN "profileCompletedAt" TIMESTAMP(3),
  ADD COLUMN "profileCompletedById" TEXT,
  ADD COLUMN "trainingCompletedAt" TIMESTAMP(3),
  ADD COLUMN "trainingCompletedById" TEXT;
