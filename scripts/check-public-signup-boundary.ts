import { readFileSync } from "node:fs";
import {
  isDuplicateAgentEmailError,
  MAX_PUBLIC_SIGNUP_BODY_BYTES,
  normalizePublicSignupInput,
} from "../src/lib/public-signup-boundary";
import { signupSchema } from "../src/lib/validation";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertContains(path: string, expected: string) {
  const content = readFileSync(path, "utf8");
  assert(content.includes(expected), `${path} is missing required public signup contract: ${expected}`);
}

function assertExcludes(path: string, forbidden: string) {
  const content = readFileSync(path, "utf8");
  assert(!content.includes(forbidden), `${path} contains forbidden public signup behavior: ${forbidden}`);
}

function checkPureBoundaryHelpers() {
  const parsed = signupSchema.parse({
    legalName: "  Jane Applicant  ",
    companyName: "  Example LLC  ",
    preferredName: "  Jane  ",
    personalEmail: "  Jane@Example.COM  ",
    mobile: "  +1 555 0100  ",
    mailingAddress: "  1 Main St  ",
    emergencyContact: "  Alex  ",
    consent: true,
    company_url: "   ",
  });
  const normalized = normalizePublicSignupInput(parsed);

  assert(normalized.legalName === "Jane Applicant", "Legal name must be trimmed.");
  assert(normalized.companyName === "Example LLC", "Company name must be trimmed.");
  assert(normalized.preferredName === "Jane", "Preferred name must be trimmed.");
  assert(normalized.personalEmail === "jane@example.com", "Email must be canonicalized to lowercase.");
  assert(normalized.mobile === "+1 555 0100", "Mobile must be trimmed.");
  assert(normalized.mailingAddress === "1 Main St", "Mailing address must be trimmed.");
  assert(normalized.emergencyContact === "Alex", "Emergency contact must be trimmed.");
  assert(normalized.company_url === "", "Whitespace-only honeypot values must normalize to empty.");
  assert(MAX_PUBLIC_SIGNUP_BODY_BYTES === 16_384, "Public signup body limit changed unexpectedly.");
  assert(isDuplicateAgentEmailError({ code: "P2002" }), "Prisma unique conflicts must be recognized.");
  assert(!isDuplicateAgentEmailError({ code: "P1001" }), "Connectivity failures must not be treated as duplicate submissions.");
}

function checkRouteContract() {
  const routePath = "src/app/api/signup/route.ts";
  const route = readFileSync(routePath, "utf8");

  for (const expected of [
    "MAX_PUBLIC_SIGNUP_BODY_BYTES",
    "preparePublicJsonBody(req",
    "maxBodyBytes: MAX_PUBLIC_SIGNUP_BODY_BYTES",
    "requestId: id",
    "if (!prepared.ok) return prepared.response",
    "signupSchema.safeParse(prepared.body)",
    "normalizePublicSignupInput",
    "isDuplicateAgentEmailError",
    "routeRequestId(req)",
    "routeJsonResponse",
    "noindex: true",
    "const ACCEPTED_STATUS = 202",
    "return json({ ok: true }, ACCEPTED_STATUS, id)",
    "if (data.company_url) return accepted(id)",
    "reservation = await db.$transaction",
    "const agent = await tx.agent.create",
    "const audit = await tx.auditLog.create",
    'ghl: "pending"',
    "const ghl = await upsertSalesHqContact",
    'source: "GHL_AGENT_SIGNUP"',
    'message: "Agent signup contact sync failed."',
    'payload: { operation: "contacts/upsert", requestId: id }',
    "return accepted(id);",
    "integration finalization failed",
    "The application and initial audit are already durable",
  ]) assertContains(routePath, expected);

  const reservationIndex = route.indexOf("reservation = await db.$transaction");
  const ghlIndex = route.indexOf("const ghl = await upsertSalesHqContact");
  assert(reservationIndex >= 0 && ghlIndex > reservationIndex, "The durable local reservation must occur before the GHL side effect.");
  assert((route.match(/upsertSalesHqContact/g) ?? []).length === 2, "Signup route must import and invoke the GHL upsert exactly once.");
  assert((route.match(/tx\.agent\.create/g) ?? []).length === 1, "Signup route must create the Agent exactly once.");
  assert((route.match(/tx\.auditLog\.create/g) ?? []).length === 1, "Signup route must create the initial audit exactly once.");
  assert((route.match(/return accepted\(id\)/g) ?? []).length === 3, "New, duplicate, and honeypot accepted outcomes must share one response contract.");

  for (const forbidden of [
    "req.text()",
    "request.text()",
    "JSON.parse(",
    "TextEncoder",
    "content-length",
    "NextResponse",
    "db.agent.findUnique",
    "db.agent.findFirst",
    "ghlError:",
    "ghl.error",
    "{ ok: true, agentId:",
    "ghl: ghl.ok",
    "Please check whether this email already exists",
    "status: 409",
  ]) assertExcludes(routePath, forbidden);
}

function checkSharedBoundaries() {
  const responsePath = "src/lib/route-json-response.ts";
  for (const expected of [
    '"Cache-Control": "no-store, max-age=0"',
    'headers["X-Request-Id"] = requestId',
    'headers["X-Robots-Tag"] = "noindex, nofollow, noarchive"',
    "MAX_REQUEST_ID_LENGTH = 128",
    "REQUEST_ID_PATTERN",
  ]) assertContains(responsePath, expected);

  const bodyPath = "src/lib/public-json-body-boundary.ts";
  for (const expected of [
    "Number(request.headers.get(\"content-length\") ?? \"0\")",
    "declaredLength > maxBodyBytes",
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
  ]) assertContains(bodyPath, expected);
}

function checkRepositoryContract() {
  for (const [path, expected] of [
    ["src/app/signup/page.tsx", 'const res = await fetch("/api/signup"'],
    ["src/app/signup/page.tsx", "setDone(true)"],
    ["docs/PUBLIC_SIGNUP.md", "Durable reservation before GHL"],
    ["docs/PUBLIC_SIGNUP.md", "HTTP 202"],
    ["docs/PUBLIC_SIGNUP.md", "does not expose"],
    ["docs/INDEX.md", "PUBLIC_SIGNUP.md"],
    ["package.json", '"check:public-signup-boundary": "tsx scripts/check-public-signup-boundary.ts"'],
    ["package.json", "check-public-signup-boundary.ts"],
    ["src/lib/lead-deployment-verification.ts", "Public signup boundary guard passed."],
    ["scripts/check-deployment-verification-guard.ts", "Public signup boundary guard passed."],
  ] as const) assertContains(path, expected);
}

function main() {
  checkPureBoundaryHelpers();
  checkRouteContract();
  checkSharedBoundaries();
  checkRepositoryContract();
  console.log("Public signup boundary guard passed.");
}

main();
