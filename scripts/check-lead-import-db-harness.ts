import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import {
  assertDatabaseIntegrationTestEnvironment,
  resolveDatabaseUrlForRuntime,
} from "../src/lib/db-integration-test-guard";

const primary = "postgresql://primary.example.com:5432/mcd";
const test = "postgresql://test.example.com:5432/mcd_test";

assert.equal(resolveDatabaseUrlForRuntime({ DATABASE_URL: primary }), primary);
assert.equal(
  assertDatabaseIntegrationTestEnvironment({
    DATABASE_URL: primary,
    MCD_RUN_DB_INTEGRATION_TESTS: "1",
    MCD_TEST_DATABASE_URL: test,
  }),
  test,
);
assert.throws(() => assertDatabaseIntegrationTestEnvironment({ DATABASE_URL: primary }));
assert.throws(() => assertDatabaseIntegrationTestEnvironment({
  DATABASE_URL: primary,
  MCD_RUN_DB_INTEGRATION_TESTS: "1",
}));
assert.throws(() => assertDatabaseIntegrationTestEnvironment({
  DATABASE_URL: primary,
  MCD_RUN_DB_INTEGRATION_TESTS: "1",
  MCD_TEST_DATABASE_URL: "postgresql://primary.example.com:5432/mcd?sslmode=require",
}));

const harness = readFileSync("scripts/test-lead-import-lifecycle-db.ts", "utf8");
const packageJson = readFileSync("package.json", "utf8");
assert.match(harness, /assertDatabaseIntegrationTestEnvironment/);
assert.match(harness, /MCD_DBTEST_/);
assert.match(harness, /await cleanup\(\)/);
assert.match(harness, /previewImportWithAudit/);
assert.match(harness, /submitImportWithAudit/);
assert.match(harness, /LeadImportBatchReplayConflictError/);
assert.match(harness, /leadActivity/);
assert.match(harness, /auditLog/);
assert.match(packageJson, /test:lead-import-db/);
assert.match(packageJson, /--conditions=react-server/);

console.log("Lead import database harness checks passed.");
