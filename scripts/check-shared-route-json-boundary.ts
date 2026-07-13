import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function read(path: string) {
  return readFileSync(path, "utf8");
}

function assertContains(path: string, expected: string) {
  assert(read(path).includes(expected), `${path} is missing shared route JSON behavior: ${expected}`);
}

function checkHelper() {
  const path = "src/lib/route-json-response.ts";
  const content = read(path);

  for (const expected of [
    'import "server-only"',
    "routeRequestId",
    "routeJsonResponse",
    "MAX_REQUEST_ID_LENGTH = 128",
    "REQUEST_ID_PATTERN",
    '"Cache-Control": "no-store, max-age=0"',
    'headers["X-Request-Id"] = requestId',
    'headers["X-Robots-Tag"] = "noindex, nofollow, noarchive"',
    'headers["Retry-After"] = String(retryAfterSeconds)',
    "NextResponse.json(body, { status, headers })",
  ]) assertContains(path, expected);

  for (const forbidden of [
    'from "@/lib/db"',
    "process.env",
    "request.text()",
    "request.json()",
    ".create(",
    ".update(",
    ".delete(",
    ".$transaction",
    "console.",
  ]) assert(!content.includes(forbidden), `${path} contains forbidden database, parsing, mutation, environment, or logging behavior: ${forbidden}`);
}

function checkRoute(path: string, expected: string[]) {
  const content = read(path);
  for (const value of expected) assert(content.includes(value), `${path} is missing shared route JSON adoption: ${value}`);
  for (const forbidden of [
    "NextResponse.json",
    "new NextResponse",
    "request.text()",
    "req.text()",
    "request.json()",
    "req.json()",
    "error.message",
  ]) assert(!content.includes(forbidden), `${path} retains direct route-boundary behavior: ${forbidden}`);
}

function checkRoutes() {
  checkRoute("src/app/api/activate/route.ts", [
    "routeRequestId(req)",
    "routeJsonResponse(body, { status, requestId: id, noindex: true })",
    "preparePublicJsonBody(req",
    "maxBodyBytes: MAX_ACTIVATION_BODY_BYTES",
  ]);

  checkRoute("src/app/api/signup/route.ts", [
    "routeRequestId(req)",
    "routeJsonResponse(body, { status, requestId: id, noindex: true })",
    "preparePublicJsonBody(req",
    "maxBodyBytes: MAX_PUBLIC_SIGNUP_BODY_BYTES",
    "const ACCEPTED_STATUS = 202",
  ]);

  checkRoute("src/app/api/cron/leads/aging/route.ts", [
    "routeRequestId(request)",
    "routeJsonResponse(body, {",
    "requestId: id",
    "retryAfterSeconds: retryable ? RETRY_AFTER_SECONDS : undefined",
    "const result = await runLeadAgingSweep",
  ]);

  checkRoute("src/app/api/status/route.ts", [
    "routeJsonResponse",
    "{ noindex: true }",
    'service: "crm-mcd"',
    "VERCEL_GIT_COMMIT_SHA",
  ]);
}

function checkRegistry() {
  const registry = JSON.parse(read("config/route-boundary-registry.json")) as {
    version: string;
    findings: unknown[];
  };

  assert(registry.version === "2026-07-13-pr130", "Route Boundary Registry must identify PR130.");
  assert(registry.findings.length === 0, "Shared public body handling must establish a zero-finding registry.");
}

function checkRepositoryContract() {
  for (const [path, expected] of [
    ["docs/SHARED_ROUTE_JSON_BOUNDARY.md", "Exact route contracts"],
    ["docs/SHARED_ROUTE_JSON_BOUNDARY.md", "zero reviewed findings"],
    ["docs/ROUTE_BOUNDARY_REGISTRY.md", "zero reviewed findings"],
    ["docs/INDEX.md", "SHARED_ROUTE_JSON_BOUNDARY.md"],
    ["package.json", '"check:shared-route-json-boundary": "tsx scripts/check-shared-route-json-boundary.ts"'],
    ["package.json", "check-shared-route-json-boundary.ts"],
    ["src/lib/lead-deployment-verification.ts", "Shared route JSON response boundary guard passed."],
    ["scripts/check-deployment-verification-guard.ts", "Shared route JSON response boundary guard passed."],
  ] as const) assertContains(path, expected);
}

function main() {
  checkHelper();
  checkRoutes();
  checkRegistry();
  checkRepositoryContract();
  console.log("Shared route JSON response boundary guard passed.");
}

main();
