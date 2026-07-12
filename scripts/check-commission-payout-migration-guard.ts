import { readFileSync } from "node:fs";

const MIGRATION_PATH =
  "prisma/migrations/20260701092000_add_client_service_and_ledger/migration.sql";

const migration = readFileSync(MIGRATION_PATH, "utf8");
const sqlOnly = migration
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

function assertContains(expected: string, description: string) {
  if (!sqlOnly.includes(expected)) {
    throw new Error(`${MIGRATION_PATH} is missing ${description}: ${expected}`);
  }
}

function assertExcludes(forbidden: string, description: string) {
  if (sqlOnly.includes(forbidden)) {
    throw new Error(`${MIGRATION_PATH} reintroduced ${description}: ${forbidden}`);
  }
}

function tableBlock(tableName: string) {
  const start = sqlOnly.indexOf(`CREATE TABLE "${tableName}"`);
  if (start === -1) {
    throw new Error(`${MIGRATION_PATH} is missing CREATE TABLE "${tableName}"`);
  }
  const end = sqlOnly.indexOf("\n);", start);
  if (end === -1) {
    throw new Error(`${MIGRATION_PATH} has an unterminated CREATE TABLE "${tableName}" block`);
  }
  return sqlOnly.slice(start, end + 3);
}

assertContains(
  `CREATE TYPE "CommissionLedgerEntryType" AS ENUM ('RECURRING','SETUP_FEE','REFUND_OFFSET','CHARGEBACK_HOLD','MANUAL_ADJUSTMENT');`,
  "the source-backed CommissionLedgerEntryType enum",
);
assertContains(
  `CREATE TYPE "CommissionLedgerEntryStatus" AS ENUM ('PENDING_VERIFICATION','ON_HOLD','ELIGIBLE');`,
  "the exhaustive three-state CommissionLedgerEntryStatus enum",
);
assertContains(
  `CREATE TYPE "CommissionHoldReason" AS ENUM ('PAYMENT_UNCLEARED','REFUND','CHARGEBACK','MANUAL_REVIEW','COMPLIANCE_REVIEW','SERVICE_OWNERSHIP','TERMINATED');`,
  "the CommissionHoldReason enum",
);
assertContains(
  `CREATE TYPE "CommissionEligibilityStatus" AS ENUM ('PENDING','ELIGIBLE','ON_HOLD','INELIGIBLE');`,
  "the CommissionEligibilityStatus enum",
);
assertContains(
  `CREATE TYPE "CommissionEligibilityReason" AS ENUM ('ACTIVE_SERVICE','RETIRED','AGENT_DECLINES_SERVICE','HOUSE_TRANSFER','TERMINATED','PAYMENT_UNCLEARED','MANUAL_HOLD','MISSING_SERVICE_OWNER','MANUAL_REVIEW');`,
  "the CommissionEligibilityReason enum",
);
assertContains(
  `CREATE TYPE "CommissionProfileStatus" AS ENUM ('ACTIVE','RETIRED','TERMINATED','ON_HOLD');`,
  "the CommissionProfileStatus enum",
);

for (const table of [
  "CommissionLedgerEntry",
  "CommissionHold",
  "CommissionEligibilityDecision",
  "AgentCommissionProfile",
]) {
  assertContains(`CREATE TABLE "${table}"`, `${table} table DDL`);
}

const ledgerTable = tableBlock("CommissionLedgerEntry");
for (const column of [
  `"grossCollectedCents" INTEGER NOT NULL`,
  `"refundOffsetCents" INTEGER NOT NULL DEFAULT 0`,
  `"commissionableCents" INTEGER`,
  `"proposedAgentShareCents" INTEGER`,
  `"calculationNote" TEXT`,
  `"createdById" TEXT NOT NULL`,
  `"clearedAt" TIMESTAMP(3)`,
  `"eligibleAt" TIMESTAMP(3)`,
  `"holdReason" TEXT`,
]) {
  if (!ledgerTable.includes(column)) {
    throw new Error(`${MIGRATION_PATH} is missing CommissionLedgerEntry column ${column}`);
  }
}

for (const forbiddenColumn of [
  `"contractType"`,
  `"amountCollectedCents"`,
  `"processingFeeCents"`,
  `"taxCents"`,
  `"wholesaleCents"`,
  `"netCommissionableCents"`,
  `"partnerShareCents"`,
  `"mcdShareCents"`,
  `"financeApprovedById"`,
  `"financeApprovedAt"`,
  `"payoutBatchId"`,
  `"payoutReference"`,
]) {
  if (ledgerTable.includes(forbiddenColumn)) {
    throw new Error(
      `${MIGRATION_PATH} reintroduced obsolete CommissionLedgerEntry column ${forbiddenColumn}`,
    );
  }
}

assertContains(
  `CONSTRAINT "AgentCommissionProfile_agentId_key" UNIQUE ("agentId")`,
  "AgentCommissionProfile.agentId uniqueness required by ON CONFLICT",
);
assertContains(
  `CREATE UNIQUE INDEX "CommissionEligibilityDecision_current_key" ON "CommissionEligibilityDecision"("clientAccountId", "agentId") WHERE "supersededAt" IS NULL;`,
  "single-current-decision protection",
);
assertContains(
  `ALTER TABLE "CommissionHold" ADD CONSTRAINT "CommissionHold_ledgerEntryId_fkey"`,
  "CommissionHold to CommissionLedgerEntry foreign key",
);
assertContains(
  `ALTER TABLE "CommissionEligibilityDecision" ADD CONSTRAINT "CommissionEligibilityDecision_clientAccountId_fkey"`,
  "CommissionEligibilityDecision to ClientAccount foreign key",
);
assertContains(
  `ALTER TABLE "AgentCommissionProfile" ADD CONSTRAINT "AgentCommissionProfile_agentId_fkey"`,
  "AgentCommissionProfile to Agent foreign key",
);

for (const forbidden of [
  `CREATE TYPE "ClientAccountStatus"`,
  `CREATE TABLE "ClientAccount"`,
  `CREATE TYPE "CommissionEntryType"`,
  `CREATE TYPE "CommissionEntryStatus"`,
  `CREATE TYPE "ContractType"`,
]) {
  assertExcludes(forbidden, "obsolete or already-live migration DDL");
}

console.log("Commission schema migration guard passed.");
