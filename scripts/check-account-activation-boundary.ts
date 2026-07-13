import { readFileSync } from "node:fs";
import {
  activationRequestSchema,
  ActivationUnavailableError,
  isActivationUnavailableError,
  MAX_ACTIVATION_BODY_BYTES,
} from "../src/lib/account-activation-boundary";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertContains(path: string, expected: string) {
  const content = readFileSync(path, "utf8");
  assert(content.includes(expected), `${path} is missing required activation contract: ${expected}`);
}

function assertExcludes(path: string, forbidden: string) {
  const content = readFileSync(path, "utf8");
  assert(!content.includes(forbidden), `${path} contains forbidden activation behavior: ${forbidden}`);
}

function checkSchema() {
  assert(MAX_ACTIVATION_BODY_BYTES === 8_192, "Activation body limit changed unexpectedly.");

  const prepare = activationRequestSchema.parse({
    action: "prepare",
    token: "  token  ",
    password: "correct horse battery staple",
    confirmPassword: "correct horse battery staple",
  });
  assert(prepare.token === "token", "Activation token must be trimmed without changing the existing non-empty minimum.");

  const complete = activationRequestSchema.parse({
    action: "complete",
    token: "token",
    password: "correct horse battery staple",
    confirmPassword: "correct horse battery staple",
    totpSecret: "JBSWY3DPEHPK3PXP",
    totp: "123456",
  });
  if (complete.action !== "complete") throw new Error("Complete activation input did not retain its discriminant.");
  assert(complete.totp === "123456", "Six-digit TOTP must be accepted.");

  assert(!activationRequestSchema.safeParse({ action: "prepare", token: "   ", password: "valid password here", confirmPassword: "valid password here" }).success, "Empty activation tokens must fail.");
  assert(!activationRequestSchema.safeParse({ action: "prepare", token: "x".repeat(513), password: "valid password here", confirmPassword: "valid password here" }).success, "Oversized activation tokens must fail.");
  assert(!activationRequestSchema.safeParse({ action: "prepare", token: "token", password: "            ", confirmPassword: "            " }).success, "Whitespace-only passwords must fail.");
  assert(!activationRequestSchema.safeParse({ action: "complete", token: "token", password: "valid password here", confirmPassword: "valid password here", totpSecret: "not-valid-secret!", totp: "123456" }).success, "Malformed TOTP secrets must fail.");
  assert(!activationRequestSchema.safeParse({ action: "complete", token: "token", password: "valid password here", confirmPassword: "valid password here", totpSecret: "JBSWY3DPEHPK3PXP", totp: "12345" }).success, "Non-six-digit TOTP values must fail.");

  const unavailable = new ActivationUnavailableError();
  assert(isActivationUnavailableError(unavailable), "Typed activation-unavailable errors must be recognized.");
  assert(!isActivationUnavailableError(new Error("other")), "Unrelated errors must not be classified as token races.");
}

function checkRoute() {
  const path = "src/app/api/activate/route.ts";
  const route = readFileSync(path, "utf8");

  for (const expected of [
    "MAX_ACTIVATION_BODY_BYTES",
    "preparePublicJsonBody(req",
    "maxBodyBytes: MAX_ACTIVATION_BODY_BYTES",
    "requestId: id",
    "if (!prepared.ok) return prepared.response",
    "activationRequestSchema.safeParse(prepared.body)",
    "routeRequestId(req)",
    "routeJsonResponse",
    "noindex: true",
    "tx.activationToken.updateMany",
    "usedAt: null",
    "expiresAt: { gt: now }",
    "if (consumed.count !== 1) throw new ActivationUnavailableError()",
    "const currentUser = await tx.user.findUnique",
    'currentUser.status === "DISABLED"',
    "await tx.user.update",
    'actionType: "MFA_ENROLLED"',
    'actionType: "ACTIVATION_COMPLETED"',
    "isActivationUnavailableError(error)",
    'return json({ ok: true, qrDataUrl, totpSecret }, 200, id)',
    'metadata: { requestId: id }',
    "password hashing failed",
  ]) assertContains(path, expected);

  const consumeIndex = route.indexOf("tx.activationToken.updateMany");
  const currentUserIndex = route.indexOf("const currentUser = await tx.user.findUnique");
  const userUpdateIndex = route.indexOf("await tx.user.update");
  const completedAuditIndex = route.indexOf('actionType: "ACTIVATION_COMPLETED"');
  assert(consumeIndex >= 0 && currentUserIndex > consumeIndex && userUpdateIndex > currentUserIndex && completedAuditIndex > userUpdateIndex, "Token consume, user revalidation, credential update, and completion audit must remain ordered inside one transaction.");
  assert((route.match(/tx\.activationToken\.updateMany/g) ?? []).length === 1, "Activation token must be consumed exactly once.");
  assert((route.match(/await tx\.user\.update/g) ?? []).length === 1, "Activation must update the User exactly once.");
  assert((route.match(/db\.\$transaction\(async \(tx\)/g) ?? []).length === 1, "Activation completion must use one interactive transaction.");

  for (const forbidden of [
    "req.text()",
    "request.text()",
    "JSON.parse(",
    "TextEncoder",
    "content-length",
    "NextResponse",
    "db.$transaction([",
    "db.activationToken.update({",
    "error.message",
    "stack:",
    "email: activation.user.email",
  ]) assertExcludes(path, forbidden);
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

function checkPageAndClient() {
  const pagePath = "src/app/activate/page.tsx";
  const clientPath = "src/app/activate/activation-form.tsx";

  for (const expected of [
    'export const dynamic = "force-dynamic"',
    'referrer: "no-referrer"',
    "robots: { index: false, follow: false, noarchive: true }",
    "const rawToken = token?.trim()",
    "rawToken.length <= 512",
    'activation.user.status === "DISABLED"',
    "<ActivationForm token={rawToken} />",
  ]) assertContains(pagePath, expected);

  for (const expected of [
    'window.history.replaceState(null, "", "/activate")',
    'referrerPolicy: "no-referrer"',
    'cache: "no-store"',
    'Accept: "application/json"',
    'autoComplete="one-time-code"',
    'setPassword("")',
    'setConfirmPassword("")',
    'setCode("")',
  ]) assertContains(clientPath, expected);
}

function checkRepository() {
  for (const [path, expected] of [
    ["docs/ACCOUNT_ACTIVATION.md", "Atomic single-use completion"],
    ["docs/ACCOUNT_ACTIVATION.md", "Referrer-Policy: no-referrer"],
    ["docs/ACCOUNT_ACTIVATION.md", "does not return the account email"],
    ["docs/INDEX.md", "ACCOUNT_ACTIVATION.md"],
    ["package.json", '"check:account-activation-boundary": "tsx scripts/check-account-activation-boundary.ts"'],
    ["package.json", "check-account-activation-boundary.ts"],
    ["src/lib/lead-deployment-verification.ts", "Account activation boundary guard passed."],
    ["scripts/check-deployment-verification-guard.ts", "Account activation boundary guard passed."],
  ] as const) assertContains(path, expected);
}

function main() {
  checkSchema();
  checkRoute();
  checkSharedBoundaries();
  checkPageAndClient();
  checkRepository();
  console.log("Account activation boundary guard passed.");
}

main();
