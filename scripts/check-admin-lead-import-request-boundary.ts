import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function read(path: string) {
  return readFileSync(path, "utf8");
}

function assertContains(path: string, expected: string) {
  assert(read(path).includes(expected), `${path} is missing Admin Lead import boundary behavior: ${expected}`);
}

function checkGenericParserProfile() {
  const path = "src/lib/authenticated-json-boundary.ts";
  const content = read(path);
  for (const expected of [
    "MAX_AUTHENTICATED_JSON_BODY_BYTES = 16_384",
    "maxBodyBytes = MAX_AUTHENTICATED_JSON_BODY_BYTES",
    "declaredLength > maxBodyBytes",
    "new TextEncoder().encode(rawText).byteLength > maxBodyBytes",
    "JSON.parse(rawText)",
  ]) assertContains(path, expected);

  const declared = content.indexOf("declaredLength > maxBodyBytes");
  const bodyRead = content.indexOf("rawText = await request.text()");
  const actual = content.indexOf("new TextEncoder().encode(rawText).byteLength > maxBodyBytes");
  const parsed = content.indexOf("JSON.parse(rawText)");
  assert(declared >= 0 && bodyRead > declared && actual > bodyRead && parsed > actual,
    "Authenticated JSON profiles must enforce declared size, read, enforce actual size, then parse.");
}

function checkAdminAdapter() {
  const path = "src/lib/admin-lead-import-request-boundary.ts";
  const content = read(path);
  for (const expected of [
    "MAX_ADMIN_LEAD_IMPORT_BODY_BYTES = 1_000_000",
    "MAX_ADMIN_LEAD_IMPORT_ROWS = 500",
    "prepareAuthenticatedJson(request, requestId, MAX_ADMIN_LEAD_IMPORT_BODY_BYTES)",
    'error: "Provide an object containing a rows array."',
    'error: "Provide at least one import row."',
    'error: "Import batches are limited to 500 rows."',
    "expectedAdminLeadImportFailure",
    "recordAdminLeadImportFailure",
    "errorName: error instanceof Error ? error.name : \"UnknownError\"",
  ]) assertContains(path, expected);

  for (const forbidden of ["request.json()", "request.text()", "NextResponse", "error.message :", "console.error(error)"]) {
    assert(!content.includes(forbidden), `${path} duplicates parsing/response behavior or exposes raw errors: ${forbidden}`);
  }
}

function checkRoutes() {
  const routes = [
    "src/app/api/admin/leads/import/preview/route.ts",
    "src/app/api/admin/leads/import/route.ts",
  ];

  for (const path of routes) {
    const content = read(path);
    for (const expected of [
      'export const dynamic = "force-dynamic"',
      "adminLeadImportRequestId(request)",
      "if (!features.leads) return adminLeadImportJson({ error: \"Not found.\" }, 404, requestId)",
      "await requireRole(ADMIN_ROLES)",
      "prepareAdminLeadImportJson(request, requestId)",
      "if (!prepared.ok) return prepared.response",
      "readAdminLeadImportRows(prepared.raw)",
      "adminLeadImportJson",
    ]) assert(content.includes(expected), `${path} is missing protected Admin import behavior: ${expected}`);

    const featureIndex = content.indexOf("if (!features.leads)");
    const authIndex = content.indexOf("await requireRole(ADMIN_ROLES)");
    const parseIndex = content.indexOf("prepareAdminLeadImportJson(request, requestId)");
    assert(featureIndex >= 0 && authIndex > featureIndex && parseIndex > authIndex,
      `${path} must feature-gate and authorize before consuming the body.`);

    for (const forbidden of [
      "request.json()",
      "request.text()",
      "NextResponse",
      "error instanceof Error ? error.message",
      "requireFeature(",
    ]) assert(!content.includes(forbidden), `${path} contains forbidden route-level behavior: ${forbidden}`);
  }

  const preview = read(routes[0]);
  assert(preview.includes("previewLeadImport(input.rows)"), "Admin import preview must preserve previewLeadImport.");
  assert(preview.includes('adminLeadImportJson({ error: "Lead preview failed." }, 500, requestId)'),
    "Admin import preview must return a generic unexpected-failure response.");

  const commit = read(routes[1]);
  assert(commit.includes("commitLeadImport(input.rows)"), "Admin import commit must preserve commitLeadImport.");
  assert(commit.includes("adminLeadImportJson(result, 201, requestId)"), "Admin import commit must preserve HTTP 201.");
  assert(commit.includes("expectedAdminLeadImportFailure(error)"), "Admin import commit must map only approved expected failures.");
  assert(commit.includes('adminLeadImportJson({ error: "Lead import failed." }, 500, requestId)'),
    "Admin import commit must return a generic unexpected-failure response.");
}

function checkServiceContract() {
  const path = "src/lib/lead-import-commit.ts";
  for (const expected of [
    'requireFeature("leads")',
    "requireRole(ADMIN_ROLES)",
    "rows.length > 500",
    "previewLeadImport(rows)",
    "db.$transaction",
    'actionType: "LEAD_IMPORTED_TO_REVIEW"',
    "return { inserted: approved.length, duplicateInDatabase, suppressed, rejected, rows: preview }",
  ]) assertContains(path, expected);
}

function checkRepositoryContract() {
  for (const [path, expected] of [
    ["docs/ADMIN_LEAD_IMPORT_REQUEST_BOUNDARY.md", "Authorization before body reads"],
    ["docs/ADMIN_LEAD_IMPORT_REQUEST_BOUNDARY.md", "1 MiB"],
    ["docs/ADMIN_LEAD_IMPORT_REQUEST_BOUNDARY.md", "does not invoke preview or commit"],
    ["docs/INDEX.md", "ADMIN_LEAD_IMPORT_REQUEST_BOUNDARY.md"],
    ["package.json", '"check:admin-lead-import-request-boundary": "tsx scripts/check-admin-lead-import-request-boundary.ts"'],
    ["package.json", "check-admin-lead-import-request-boundary.ts"],
    ["src/lib/lead-deployment-verification.ts", "Admin Lead import request boundary guard passed."],
    ["scripts/check-deployment-verification-guard.ts", "Admin Lead import request boundary guard passed."],
  ] as const) assertContains(path, expected);
}

function main() {
  checkGenericParserProfile();
  checkAdminAdapter();
  checkRoutes();
  checkServiceContract();
  checkRepositoryContract();
  console.log("Admin Lead import request boundary guard passed.");
}

main();
