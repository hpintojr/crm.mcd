import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function read(path: string) {
  return readFileSync(path, "utf8");
}

function assertContains(path: string, expected: string) {
  assert(read(path).includes(expected), `${path} is missing required Admin controlled-test boundary: ${expected}`);
}

function checkGenericBoundary() {
  const path = "src/lib/authenticated-json-boundary.ts";
  const content = read(path);
  for (const expected of [
    "MAX_AUTHENTICATED_JSON_BODY_BYTES = 16_384",
    "authenticatedRequestId",
    "authenticatedJson",
    "prepareAuthenticatedJson",
    "const declaredLength = Number(request.headers.get(\"content-length\")",
    "rawText = await request.text()",
    "new TextEncoder().encode(rawText).byteLength",
    "JSON.parse(rawText)",
    '"Cache-Control": "no-store, max-age=0"',
    '"X-Request-Id": requestId',
    '"X-Robots-Tag": "noindex, nofollow, noarchive"',
  ]) {
    assert(content.includes(expected), `${path} is missing authenticated JSON behavior: ${expected}`);
  }
}

function checkExpectedErrors() {
  const path = "src/lib/admin-controlled-test-boundary.ts";
  const content = read(path);
  for (const expected of [
    "expectedControlledGhlTestFailure",
    "Unsupported controlled GHL test event type.",
    "Choose an appointment event type for the appointment harness.",
    "Choose an opportunity event type for the opportunity harness.",
    "Controlled test Lead not found.",
    "The GHL test harness only accepts controlled test Leads.",
    "Lead module is not enabled.",
    "This action is restricted to controlled test Leads.",
    "return null",
  ]) {
    assert(content.includes(expected), `${path} is missing expected-error behavior: ${expected}`);
  }
  assert(!content.includes("console."), "Expected Admin controlled-test errors must not log request or Lead data.");
}

function checkRoute() {
  const path = "src/app/api/admin/integrations/test-events/route.ts";
  const content = read(path);
  for (const expected of [
    'export const dynamic = "force-dynamic"',
    "authenticatedRequestId(request)",
    "requireRole(ADMIN_ROLES)",
    "prepareAuthenticatedJson(request, requestId)",
    "if (!prepared.ok) return prepared.response",
    "schema.safeParse(prepared.raw)",
    "previewControlledGhlTestEvent(input)",
    "applyControlledGhlTestEvent(input)",
    "expectedControlledGhlTestFailure(error)",
    "authenticatedJson",
    "throw error",
  ]) {
    assert(content.includes(expected), `${path} is missing controlled-test request behavior: ${expected}`);
  }

  const authIndex = content.indexOf("requireRole(ADMIN_ROLES)");
  const prepareIndex = content.indexOf("prepareAuthenticatedJson(request, requestId)");
  const schemaIndex = content.indexOf("schema.safeParse(prepared.raw)");
  assert(authIndex >= 0 && prepareIndex > authIndex && schemaIndex > prepareIndex, "Admin authorization must occur before body reading and schema validation.");

  for (const forbidden of [
    "request.json()",
    "NextResponse.json",
    "error.message",
    "console.log",
    "console.warn",
    "console.error",
  ]) {
    assert(!content.includes(forbidden), `${path} contains forbidden request or error behavior: ${forbidden}`);
  }

  assert((content.match(/applyControlledGhlTestEvent\(input\)/g) ?? []).length === 1, "Apply semantics must remain a single explicit service call.");
  assert((content.match(/previewControlledGhlTestEvent\(input\)/g) ?? []).length === 1, "Preview semantics must remain a single explicit service call.");
}

function checkRepositoryContract() {
  for (const [path, expected] of [
    ["docs/ADMIN_CONTROLLED_TEST_REQUEST_BOUNDARY.md", "Admin authorization before body reads"],
    ["docs/ADMIN_CONTROLLED_TEST_REQUEST_BOUNDARY.md", "16 KiB"],
    ["docs/ADMIN_CONTROLLED_TEST_REQUEST_BOUNDARY.md", "does not call the endpoint"],
    ["docs/INDEX.md", "ADMIN_CONTROLLED_TEST_REQUEST_BOUNDARY.md"],
    ["package.json", '"check:admin-controlled-test-boundary": "tsx scripts/check-admin-controlled-test-boundary.ts"'],
    ["package.json", "check-admin-controlled-test-boundary.ts"],
    ["src/lib/lead-deployment-verification.ts", "Admin controlled test request boundary guard passed."],
    ["scripts/check-deployment-verification-guard.ts", "Admin controlled test request boundary guard passed."],
  ] as const) {
    assertContains(path, expected);
  }
}

function main() {
  checkGenericBoundary();
  checkExpectedErrors();
  checkRoute();
  checkRepositoryContract();
  console.log("Admin controlled test request boundary guard passed.");
}

main();
