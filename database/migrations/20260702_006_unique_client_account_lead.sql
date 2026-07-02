-- Client onboarding integrity hardening.
-- A Lead can create at most one ClientAccount.
-- Apply only through the controlled Neon safety-branch workflow after confirming no duplicate linked accounts exist.

CREATE UNIQUE INDEX IF NOT EXISTS "ClientAccount_leadId_unique"
  ON "ClientAccount"("leadId")
  WHERE "leadId" IS NOT NULL;
