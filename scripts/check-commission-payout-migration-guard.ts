import { readFileSync } from "node:fs";

const MIGRATION_PATH =
  "prisma/migrations/20260701092000_add_client_service_and_ledger/migration.sql";

function assertContains(path: string, expected: string) {
  const content = readFileSync(path, "utf8");
  if (!content.includes(expected)) {
    throw new Error(`${path} is missing required correction note: ${expected}`);
  }
}

// Strips SQL comment lines (starting with --) before checking for forbidden DDL, so this guard
// does not false-positive on the file's own explanatory comment (which quotes the forbidden
// statement for documentation purposes) and only fires if the real DDL statement is re-added.
function assertNotReintroduced(path: string, forbiddenStatement: string) {
  const content = readFileSync(path, "utf8");
  const sqlOnly = content
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  if (sqlOnly.includes(forbiddenStatement)) {
    throw new Error(
      `${path} must not recreate ${forbiddenStatement} — that type already exists in production ` +
        "(confirmed via a Neon safety-branch test on 2026-07-12; see LOCK.md).",
    );
  }
}

// Guards against silently reverting the 2026-07-12 correction to this migration file. The file
// originally also created Client/Service schema (ClientAccount, ClientServiceActivity, and their
// enums), which a Neon safety-branch test confirmed already exists in production today. Re-adding
// those CREATE TYPE / CREATE TABLE statements would make the file fail immediately the moment
// anyone tries to apply it, exactly as the original (uncorrected) file did on the safety branch.
assertContains(MIGRATION_PATH, "CORRECTED 2026-07-12");
assertContains(
  MIGRATION_PATH,
  "ClientAccount, ClientServiceActivity, ClientServiceCase, ClientServiceAssignmentEvent, and",
);
assertNotReintroduced(MIGRATION_PATH, 'CREATE TYPE "ClientAccountStatus"');
assertNotReintroduced(MIGRATION_PATH, 'CREATE TABLE "ClientAccount"');

console.log("Commission/payout migration correction guard passed.");
