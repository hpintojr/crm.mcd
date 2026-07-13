import { readFileSync } from "node:fs";
import {
  isTransientDatabaseError,
  retryTransientDatabaseOperation,
  TransientDatabaseRetryExhaustedError,
} from "../src/lib/transient-database-retry";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function transientError(code = "P1001") {
  return Object.assign(new Error("Can't reach database server at pooler.example.invalid:5432"), {
    name: "PrismaClientInitializationError",
    code,
  });
}

async function checkRetryHelper() {
  let attempts = 0;
  const immediate = await retryTransientDatabaseOperation(async () => {
    attempts += 1;
    return "ready";
  }, { initialDelayMs: 0, maxDelayMs: 0 });
  assert(immediate.value === "ready" && immediate.attempts === 1 && attempts === 1, "Immediate database readiness should not retry.");

  attempts = 0;
  const recovered = await retryTransientDatabaseOperation(async () => {
    attempts += 1;
    if (attempts < 3) throw transientError();
    return "recovered";
  }, { maxAttempts: 3, initialDelayMs: 0, maxDelayMs: 0 });
  assert(recovered.value === "recovered" && recovered.attempts === 3 && attempts === 3, "Transient database failures should retry within the bound.");

  attempts = 0;
  const delayedRecovery = await retryTransientDatabaseOperation(async () => {
    attempts += 1;
    if (attempts < 5) throw transientError();
    return "recovered-on-final-attempt";
  }, { maxAttempts: 5, initialDelayMs: 0, maxDelayMs: 0 });
  assert(
    delayedRecovery.value === "recovered-on-final-attempt" && delayedRecovery.attempts === 5 && attempts === 5,
    "The readiness helper must support recovery on the fifth and final bounded attempt.",
  );

  attempts = 0;
  let nonTransient: unknown;
  try {
    await retryTransientDatabaseOperation(async () => {
      attempts += 1;
      throw new Error("Invalid Lead aging input.");
    }, { maxAttempts: 3, initialDelayMs: 0, maxDelayMs: 0 });
  } catch (error) {
    nonTransient = error;
  }
  assert(nonTransient instanceof Error && !(nonTransient instanceof TransientDatabaseRetryExhaustedError), "Non-transient failures must surface unchanged.");
  assert(attempts === 1, "Non-transient failures must not retry.");

  attempts = 0;
  let exhausted: unknown;
  try {
    await retryTransientDatabaseOperation(async () => {
      attempts += 1;
      throw transientError("P2024");
    }, { maxAttempts: 5, initialDelayMs: 0, maxDelayMs: 0 });
  } catch (error) {
    exhausted = error;
  }
  assert(exhausted instanceof TransientDatabaseRetryExhaustedError, "Exhausted transient failures must use the typed error.");
  assert(exhausted.attempts === 5 && attempts === 5 && exhausted.retryable, "Exhaustion must report the bounded five-attempt count and retryability.");

  assert(isTransientDatabaseError({ cause: transientError() }), "Wrapped transient database failures must be detected.");
  assert(isTransientDatabaseError(new Error("connection pool timeout")), "Pool timeout messages must be detected.");
  assert(!isTransientDatabaseError(new Error("Unique constraint failed")), "Business/data errors must not be classified as transient connectivity failures.");
}

function assertContains(content: string, expected: string, label: string) {
  assert(content.includes(expected), `${label} is missing: ${expected}`);
}

function checkRouteContract() {
  const routePath = "src/app/api/cron/leads/aging/route.ts";
  const route = readFileSync(routePath, "utf8");
  const helper = readFileSync("src/lib/transient-database-retry.ts", "utf8");
  const responseBoundary = readFileSync("src/lib/route-json-response.ts", "utf8");

  for (const expected of [
    'export const maxDuration = 90',
    "DATABASE_PROBE_MAX_ATTEMPTS = 5",
    "DATABASE_PROBE_INITIAL_DELAY_MS = 1_000",
    "DATABASE_PROBE_MAX_DELAY_MS = 8_000",
    "initialDelayMs: DATABASE_PROBE_INITIAL_DELAY_MS",
    "maxDelayMs: DATABASE_PROBE_MAX_DELAY_MS",
    "SELECT 1 AS \"ready\"",
    "retryTransientDatabaseOperation",
    "The mutating sweep runs exactly once",
    "const result = await runLeadAgingSweep",
    "routeRequestId(request)",
    "routeJsonResponse",
    "requestId: id",
    "retryAfterSeconds: retryable ? RETRY_AFTER_SECONDS : undefined",
    "database-readiness",
    "Lead aging sweep could not complete because the database connection was unavailable.",
    "databaseProbeAttempts",
  ]) {
    assertContains(route, expected, routePath);
  }

  for (const expected of [
    '"Cache-Control": "no-store, max-age=0"',
    'headers["X-Request-Id"] = requestId',
    'headers["Retry-After"] = String(retryAfterSeconds)',
  ]) assertContains(responseBoundary, expected, "src/lib/route-json-response.ts");

  assert((route.match(/await runLeadAgingSweep/g) ?? []).length === 1, "The mutating Lead aging sweep must be awaited exactly once in the route.");
  assert(!/retryTransientDatabaseOperation[\s\S]{0,300}runLeadAgingSweep/.test(route), "The mutating sweep must never be wrapped in the retry helper.");
  assert(!route.includes("error.message"), "Client or structured route handling must not expose raw database error messages.");
  assert(!route.includes("NextResponse"), "Lead aging cron must not construct JSON responses directly.");

  for (const expected of [
    'new Set(["P1001", "P1002", "P1008", "P1017", "P2024"])',
    "TRANSIENT_DATABASE_MESSAGE_PATTERNS",
    "TransientDatabaseRetryExhaustedError",
    "maxAttempts, 3, 1, 5",
    "initialDelayMs * 2 ** (attempt - 1)",
  ]) {
    assertContains(helper, expected, "src/lib/transient-database-retry.ts");
  }
}

function checkRepositoryContract() {
  const packageJson = readFileSync("package.json", "utf8");
  const deploymentVerification = readFileSync("src/lib/lead-deployment-verification.ts", "utf8");
  const deploymentGuard = readFileSync("scripts/check-deployment-verification-guard.ts", "utf8");
  const docs = readFileSync("docs/LEAD_AGING_CRON.md", "utf8");
  const index = readFileSync("docs/INDEX.md", "utf8");
  const readme = readFileSync("README.md", "utf8");

  assertContains(packageJson, '"check:lead-aging-cron-resilience": "tsx scripts/check-lead-aging-cron-resilience.ts"', "package.json");
  assertContains(packageJson, "check-lead-aging-cron-resilience.ts", "package.json build guard chain");
  assertContains(deploymentVerification, "Lead aging cron resilience guard passed.", "deployment verification");
  assertContains(deploymentGuard, "Lead aging cron resilience guard passed.", "deployment verification guard");
  assertContains(docs, "The actual Lead aging sweep is **never retried**", "docs/LEAD_AGING_CRON.md");
  assertContains(docs, "1, 2, 4, and 8 seconds", "docs/LEAD_AGING_CRON.md");
  assertContains(docs, "90-second", "docs/LEAD_AGING_CRON.md");
  assertContains(docs, "X-Request-Id", "docs/LEAD_AGING_CRON.md");
  assertContains(index, "LEAD_AGING_CRON.md", "docs/INDEX.md");
  assertContains(readme, "never retries the mutating sweep", "README.md");
}

async function main() {
  await checkRetryHelper();
  checkRouteContract();
  checkRepositoryContract();
  console.log("Lead aging cron resilience guard passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
