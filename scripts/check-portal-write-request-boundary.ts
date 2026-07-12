import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function read(path: string) {
  return readFileSync(path, "utf8");
}

function assertContains(path: string, expected: string) {
  assert(read(path).includes(expected), `${path} is missing required portal request boundary: ${expected}`);
}

function checkSharedBoundary() {
  const path = "src/lib/portal-request-boundary.ts";
  const content = read(path);

  for (const expected of [
    "MAX_PORTAL_WRITE_BODY_BYTES = 16_384",
    "portalRequestId",
    "portalJson",
    "portalNoContent",
    "preparePortalJson",
    "expectedColdLeadCallFailure",
    "const declaredLength = Number(request.headers.get(\"content-length\")",
    "rawText = await request.text()",
    "new TextEncoder().encode(rawText).byteLength",
    "JSON.parse(rawText)",
    '"Cache-Control": "no-store, max-age=0"',
    '"X-Request-Id": requestId',
    '"X-Robots-Tag": "noindex, nofollow, noarchive"',
    "This action is not available for this Lead.",
  ]) {
    assert(content.includes(expected), `${path} is missing shared boundary behavior: ${expected}`);
  }

  const prepareIndex = content.indexOf("export async function preparePortalJson");
  const declaredIndex = content.indexOf("const declaredLength", prepareIndex);
  const textIndex = content.indexOf("rawText = await request.text()", prepareIndex);
  const actualIndex = content.indexOf("new TextEncoder().encode(rawText).byteLength", prepareIndex);
  const parseIndex = content.indexOf("JSON.parse(rawText)", prepareIndex);
  assert(
    prepareIndex >= 0 && declaredIndex > prepareIndex && textIndex > declaredIndex && actualIndex > textIndex && parseIndex > actualIndex,
    "Portal JSON must enforce declared size, read, enforce actual size, then parse.",
  );
  assert((content.match(/NextResponse\.json/g) ?? []).length === 1, "Portal JSON responses must use one centralized helper.");
}

function checkLeadWriteRoutes() {
  const routes = [
    "src/app/api/portal/actions/route.ts",
    "src/app/api/portal/dnc/route.ts",
    "src/app/api/portal/leads/call-start/route.ts",
    "src/app/api/portal/release/route.ts",
  ];

  for (const path of routes) {
    const content = read(path);
    for (const expected of [
      'export const dynamic = "force-dynamic"',
      "portalRequestId(request)",
      "preparePortalJson(request, requestId)",
      "if (!prepared.ok) return prepared.response",
      "portalJson",
      "requireRole",
    ]) {
      assert(content.includes(expected), `${path} is missing portal request-boundary usage: ${expected}`);
    }

    const authIndex = content.indexOf("requireRole(");
    const prepareIndex = content.indexOf("preparePortalJson(request, requestId)");
    assert(authIndex >= 0 && prepareIndex > authIndex, `${path} must authenticate before reading the body.`);

    for (const forbidden of ["request.json()", "NextResponse.json", "error.message"]) {
      assert(!content.includes(forbidden), `${path} contains forbidden route-level behavior: ${forbidden}`);
    }
  }

  const callStart = read("src/app/api/portal/leads/call-start/route.ts");
  assert(callStart.includes("expectedColdLeadCallFailure(error)"), "Call-start must map only approved expected failures.");
  assert(callStart.includes("throw error"), "Call-start must rethrow unexpected failures to telemetry.");
}

function checkLogoutCompatibilityRoute() {
  const path = "src/app/api/auth/logout-audit/route.ts";
  const content = read(path);
  for (const expected of [
    'export const dynamic = "force-dynamic"',
    "portalNoContent(portalRequestId(request))",
    "NextAuth's signOut event records the LOGOUT audit",
  ]) {
    assert(content.includes(expected), `${path} is missing logout compatibility boundary: ${expected}`);
  }

  for (const forbidden of ["request.json()", "request.text()", "db.", "auditLog", "NextResponse"]) {
    assert(!content.includes(forbidden), `${path} must remain side-effect free: ${forbidden}`);
  }
}

function checkRepositoryContract() {
  for (const [path, expected] of [
    ["docs/PORTAL_WRITE_REQUEST_BOUNDARY.md", "Authentication before body reads"],
    ["docs/PORTAL_WRITE_REQUEST_BOUNDARY.md", "16 KiB"],
    ["docs/PORTAL_WRITE_REQUEST_BOUNDARY.md", "does not submit a portal action"],
    ["docs/INDEX.md", "PORTAL_WRITE_REQUEST_BOUNDARY.md"],
    ["package.json", '"check:portal-write-request-boundary": "tsx scripts/check-portal-write-request-boundary.ts"'],
    ["package.json", "check-portal-write-request-boundary.ts"],
    ["src/lib/lead-deployment-verification.ts", "Portal write request boundary guard passed."],
    ["scripts/check-deployment-verification-guard.ts", "Portal write request boundary guard passed."],
  ] as const) {
    assertContains(path, expected);
  }
}

function main() {
  checkSharedBoundary();
  checkLeadWriteRoutes();
  checkLogoutCompatibilityRoute();
  checkRepositoryContract();
  console.log("Portal write request boundary guard passed.");
}

main();
