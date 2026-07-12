import { readFileSync } from "node:fs";

const authPath = "src/auth.ts";
const auth = readFileSync(authPath, "utf8");

function assertContains(expected: string) {
  if (!auth.includes(expected)) {
    throw new Error(`${authPath} is missing required auth telemetry contract: ${expected}`);
  }
}

function assertExcludes(forbidden: string) {
  if (auth.includes(forbidden)) {
    throw new Error(`${authPath} must not expose sensitive auth data in telemetry: ${forbidden}`);
  }
}

for (const expected of [
  "expectedCredentialsCode",
  "error instanceof CredentialsSignin",
  'candidate.type !== "CredentialsSignin"',
  "logger:",
  'console.info("[auth] credentials rejected", { type: "CredentialsSignin", code })',
  'console.error("[auth][error]", error)',
  'actionType: "LOGIN_FAILED"',
  'actionType: "ACCOUNT_LOCKED"',
  'actionType: "LOGIN_SUCCESS"',
  "throw new MfaRequiredError()",
  "throw new MfaInvalidError()",
  "throw new AccountLockedError()",
]) {
  assertContains(expected);
}

for (const forbidden of [
  "console.log(email",
  "console.info(email",
  "console.error(email",
  "console.log(password",
  "console.info(password",
  "console.error(password",
  "console.log(totp",
  "console.info(totp",
  "console.error(totp",
  "credentials rejected\", { email",
  "credentials rejected\", { password",
  "credentials rejected\", { totp",
]) {
  assertExcludes(forbidden);
}

console.log("Auth telemetry hygiene guard passed.");
