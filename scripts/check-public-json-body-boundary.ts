import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function read(path: string) {
  return readFileSync(path, "utf8");
}

function assertContains(path: string, expected: string) {
  assert(read(path).includes(expected), `${path} is missing public JSON body behavior: ${expected}`);
}

function checkHelper() {
  const path = "src/lib/public-json-body-boundary.ts";
  const content = read(path);

  for (const expected of [
    'import "server-only"',
    "preparePublicJsonBody",
    "maxBodyBytes: number",
    "requestId: string",
    "Number(request.headers.get(\"content-length\") ?? \"0\")",
    "Number.isFinite(declaredLength) && declaredLength > maxBodyBytes",
    "rawText = await request.text()",
    "new TextEncoder().encode(rawText).byteLength > maxBodyBytes",
    "JSON.parse(rawText)",
    '{ error: "Request too large." }',
    '{ error: "Unable to read request." }',
    '{ error: "Invalid JSON" }',
    "status: 413",
    "status: 400",
    "requestId",
    "noindex: true",
    "ok: true as const",
    "ok: false as const",
  ]) assertContains(path, expected);

  const declaredIndex = content.indexOf("declaredLength > maxBodyBytes");
  const readIndex = content.indexOf("rawText = await request.text()");
  const actualIndex = content.indexOf("new TextEncoder().encode(rawText).byteLength > maxBodyBytes");
  const parseIndex = content.indexOf("JSON.parse(rawText)");
  assert(declaredIndex >= 0 && readIndex > declaredIndex && actualIndex > readIndex && parseIndex > actualIndex,
    "Declared limit, body read, actual UTF-8 limit, and JSON parsing must remain ordered.");

  for (const forbidden of [
    'from "@/lib/db"',
    "process.env",
    "console.",
    ".create(",
    ".update(",
    ".delete(",
    ".$transaction",
    "ZodError",
  ]) assert(!content.includes(forbidden), `${path} contains forbidden database, mutation, environment, logging, or schema behavior: ${forbidden}`);
}

function checkRoute(path: string, maxConstant: string, schemaCall: string) {
  const content = read(path);
  for (const expected of [
    "preparePublicJsonBody(req",
    `maxBodyBytes: ${maxConstant}`,
    "requestId: id",
    "if (!prepared.ok) return prepared.response",
    schemaCall,
  ]) assert(content.includes(expected), `${path} is missing shared public JSON body adoption: ${expected}`);

  for (const forbidden of [
    "req.text()",
    "request.text()",
    "req.json()",
    "request.json()",
    "JSON.parse(",
    "TextEncoder",
    "content-length",
  ]) assert(!content.includes(forbidden), `${path} retains route-level body parsing: ${forbidden}`);
}

function checkRoutes() {
  checkRoute(
    "src/app/api/activate/route.ts",
    "MAX_ACTIVATION_BODY_BYTES",
    "activationRequestSchema.safeParse(prepared.body)",
  );
  checkRoute(
    "src/app/api/signup/route.ts",
    "MAX_PUBLIC_SIGNUP_BODY_BYTES",
    "signupSchema.safeParse(prepared.body)",
  );
}

function checkRegistry() {
  const registry = JSON.parse(read("config/route-boundary-registry.json")) as {
    version: string;
    reviewedAt: string;
    findings: unknown[];
  };
  assert(registry.version === "2026-07-13-pr130", "Route Boundary Registry version must match PR130.");
  assert(registry.reviewedAt === "2026-07-13", "Route Boundary Registry review date must remain explicit.");
  assert(registry.findings.length === 0, "No direct route-boundary findings may remain.");
}

function checkRepositoryContract() {
  for (const [path, expected] of [
    ["docs/PUBLIC_JSON_BODY_BOUNDARY.md", "Exact failure contracts"],
    ["docs/PUBLIC_JSON_BODY_BOUNDARY.md", "does not invoke either endpoint"],
    ["docs/ROUTE_BOUNDARY_REGISTRY.md", "zero reviewed findings"],
    ["docs/INDEX.md", "PUBLIC_JSON_BODY_BOUNDARY.md"],
    ["package.json", '"check:public-json-body-boundary": "tsx scripts/check-public-json-body-boundary.ts"'],
    ["package.json", "check-public-json-body-boundary.ts"],
    ["src/lib/lead-deployment-verification.ts", "Public JSON body boundary guard passed."],
    ["scripts/check-deployment-verification-guard.ts", "Public JSON body boundary guard passed."],
  ] as const) assertContains(path, expected);
}

function main() {
  checkHelper();
  checkRoutes();
  checkRegistry();
  checkRepositoryContract();
  console.log("Public JSON body boundary guard passed.");
}

main();
