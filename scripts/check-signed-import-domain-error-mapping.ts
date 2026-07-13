import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function read(path: string) {
  return readFileSync(path, "utf8");
}

function assertContains(path: string, expected: string) {
  assert(read(path).includes(expected), `${path} is missing signed import domain-error behavior: ${expected}`);
}

function checkMapper() {
  const path = "src/lib/lead-import-domain-error-response.ts";
  const content = read(path);
  for (const expected of [
    "LeadImportBatchNotFoundError",
    "LeadImportBatchStateError",
    "LeadImportBatchReplayConflictError",
    'error: "LEAD_IMPORT_BATCH_NOT_FOUND", message: error.message',
    'error: "LEAD_IMPORT_INVALID_STATE", message: error.message',
    'error: "LEAD_IMPORT_REPLAY_CONFLICT", message: error.message',
    "404",
    "409",
    "return null",
    "leadImportJson",
  ]) assertContains(path, expected);

  for (const forbidden of [
    "ZodError",
    "LEAD_IMPORT_INTERNAL_ERROR",
    "instanceof Error",
    "console.error",
    'from "@/lib/db"',
    ".create(",
    ".update(",
    ".delete(",
    ".$transaction",
  ]) assert(!content.includes(forbidden), `${path} contains forbidden broad, unknown, database, or mutation behavior: ${forbidden}`);
}

function checkRoutes() {
  const routes = [
    "src/app/api/lead-imports/route.ts",
    "src/app/api/lead-imports/[batchId]/route.ts",
    "src/app/api/lead-imports/[batchId]/preview/route.ts",
    "src/app/api/lead-imports/[batchId]/rows/route.ts",
    "src/app/api/lead-imports/[batchId]/submit/route.ts",
  ];

  for (const path of routes) {
    const content = read(path);
    for (const expected of [
      "leadImportDomainErrorResponse",
      "const domainError = leadImportDomainErrorResponse(error, guard.requestId)",
      "if (domainError) return domainError",
      "LEAD_IMPORT_INTERNAL_ERROR",
    ]) assert(content.includes(expected), `${path} is missing centralized domain-error behavior: ${expected}`);

    for (const forbidden of [
      "error.message",
      "LeadImportBatchNotFoundError",
      "LeadImportBatchStateError",
      "LeadImportBatchReplayConflictError",
    ]) assert(!content.includes(forbidden), `${path} retains route-level domain-error behavior: ${forbidden}`);
  }

  assertContains(routes[0], "createLeadImportBatchWithConcurrencyRecovery");
  assertContains(routes[0], "created ? 201 : 200");
  assertContains(routes[0], "ZodError");
  assertContains(routes[1], "getLeadImportBatchStatus(batchId)");
  assertContains(routes[1], "serializeLeadImportBatch(batch), 200");
  assertContains(routes[2], "previewImportWithAudit(batchId)");
  assertContains(routes[2], "serializeLeadImportBatch(batch), 200");
  assertContains(routes[3], "uploadLeadImportRowsWithConcurrencyRecovery(batchId, guard.body)");
  assertContains(routes[3], "serializeLeadImportBatch(batch), 202");
  assertContains(routes[3], "ZodError");
  assertContains(routes[4], "submitImportWithAudit(batchId, input)");
  assertContains(routes[4], "serializeLeadImportBatch(batch), 200");
  assertContains(routes[4], "ZodError");
}

function checkRegistryReduction() {
  const registry = JSON.parse(read("config/route-boundary-registry.json")) as {
    version: string;
    findings: Array<{ path: string; primitive: string }>;
  };
  assert(registry.version === "2026-07-13-pr128", "Route boundary registry version must match PR128.");
  assert(registry.findings.length === 6, "Route boundary registry must be reduced from 11 to 6 findings.");
  assert(registry.findings.every((finding) => !finding.path.startsWith("src/app/api/lead-imports")),
    "Signed Lead-import routes must no longer have route-level registry findings.");
  assert(registry.findings.every((finding) => finding.primitive !== "RAW_ERROR_MESSAGE"),
    "Current registry must no longer contain route-level raw error-message findings.");
}

function checkRepositoryContract() {
  for (const [path, expected] of [
    ["docs/SIGNED_IMPORT_DOMAIN_ERRORS.md", "Typed domain errors only"],
    ["docs/SIGNED_IMPORT_DOMAIN_ERRORS.md", "does not invoke any import route"],
    ["docs/ROUTE_BOUNDARY_REGISTRY.md", "6 approved findings"],
    ["docs/LEAD_IMPORT_RESPONSE_BOUNDARY.md", "leadImportDomainErrorResponse"],
    ["docs/INDEX.md", "SIGNED_IMPORT_DOMAIN_ERRORS.md"],
    ["package.json", '"check:signed-import-domain-errors": "tsx scripts/check-signed-import-domain-error-mapping.ts"'],
    ["package.json", "check-signed-import-domain-error-mapping.ts"],
    ["src/lib/lead-deployment-verification.ts", "Signed Lead import domain error mapping guard passed."],
    ["scripts/check-deployment-verification-guard.ts", "Signed Lead import domain error mapping guard passed."],
  ] as const) assertContains(path, expected);
}

function main() {
  checkMapper();
  checkRoutes();
  checkRegistryReduction();
  checkRepositoryContract();
  console.log("Signed Lead import domain error mapping guard passed.");
}

main();
