-- Correct ClientAccount GHL identity semantics.
-- A GHL location is a shared workspace/tenant, not a unique client identifier.
-- Apply through the controlled Neon safety-branch workflow.

DROP INDEX IF EXISTS "ClientAccount_ghlLocationId_key";

ALTER TABLE "ClientAccount"
  ADD COLUMN IF NOT EXISTS "ghlOpportunityId" TEXT;

CREATE INDEX IF NOT EXISTS "ClientAccount_ghlLocationId_idx"
  ON "ClientAccount"("ghlLocationId");

CREATE INDEX IF NOT EXISTS "ClientAccount_ghlContactId_idx"
  ON "ClientAccount"("ghlContactId");

CREATE UNIQUE INDEX IF NOT EXISTS "ClientAccount_ghlOpportunityId_key"
  ON "ClientAccount"("ghlOpportunityId");
