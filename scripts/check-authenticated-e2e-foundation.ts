import { readFileSync } from "node:fs";

function read(path: string) {
  return readFileSync(path, "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function contains(path: string, expected: string) {
  assert(read(path).includes(expected), `${path} is missing authenticated E2E behavior: ${expected}`);
}

function excludes(path: string, forbidden: string) {
  assert(!read(path).includes(forbidden), `${path} contains forbidden authenticated E2E behavior: ${forbidden}`);
}

function checkWorkflow() {
  const path = ".github/workflows/authenticated-e2e.yml";
  for (const expected of [
    "name: Authenticated E2E",
    "image: postgres:17",
    "POSTGRES_DB: crm_e2e",
    "127.0.0.1:5432/crm_e2e",
    'E2E_ALLOW_DISPOSABLE_DB: "true"',
    "E2E_BASE_URL: http://127.0.0.1:3000",
    "E2E_MFA_PASSWORD: Mfa-E2E-Only-2026!",
    "E2E_LOCKOUT_PASSWORD: Lockout-E2E-Only-2026!",
    "E2E_LOCKOUT_RECOVERY_PASSWORD: Lockout-Recovery-E2E-2026!",
    "E2E_OFFBOARDED_PASSWORD: Offboarded-E2E-Only-2026!",
    "E2E_SUSPENDED_SESSION_PASSWORD: Suspended-Session-E2E-2026!",
    "E2E_ROLE_CHANGE_PASSWORD: Role-Change-E2E-2026!",
    "E2E_MFA_TOTP_SECRET: JBSWY3DPEHPK3PXP",
    'LEADS_ENABLED: "false"',
    'SERVICING_ENABLED: "false"',
    'COMMISSIONS_ENABLED: "false"',
    'FINANCE_ENABLED: "false"',
    "npx prisma db push",
    "npm run seed:e2e-auth",
    "npx playwright install --with-deps chromium",
    "npm run test:e2e:auth",
    "Assert persisted authentication security state",
    "npm run assert:e2e-auth-security",
    "actions/upload-artifact@v4",
  ]) contains(path, expected);

  for (const forbidden of [
    "secrets.",
    "crm.mercurycalldesk.com",
    "vercel.app",
    "neon.tech",
    "MIGRATION_DATABASE_URL",
    "prisma migrate deploy",
    "SERVICING_ENABLED: \"true\"",
    "COMMISSIONS_ENABLED: \"true\"",
    "FINANCE_ENABLED: \"true\"",
    "GHL_PRIVATE_TOKEN: ${{",
  ]) excludes(path, forbidden);
}

function checkSeed() {
  const path = "scripts/seed-auth-e2e.ts";
  for (const expected of [
    'process.env.E2E_ALLOW_DISPOSABLE_DB !== "true"',
    "if (process.env.VERCEL_ENV)",
    'assertDisposableDatabase("DATABASE_URL")',
    'assertDisposableDatabase("DIRECT_URL")',
    "LOCAL_DATABASE_HOSTS",
    "database name must contain an isolated e2e token",
    "e2e.owner@mercurycalldesk.test",
    "e2e.agent@mercurycalldesk.test",
    "e2e.mfa@mercurycalldesk.test",
    "e2e.lockout@mercurycalldesk.test",
    "e2e.lockout-recovery@mercurycalldesk.test",
    "e2e.offboarded@mercurycalldesk.test",
    "e2e.suspended-session@mercurycalldesk.test",
    "e2e.role-change@mercurycalldesk.test",
    "e2e.lockout-recovery@mercurycalldesk.test",
    "lockoutRecoveryPassword: process.env.E2E_LOCKOUT_RECOVERY_PASSWORD",
    "offboardedPassword: process.env.E2E_OFFBOARDED_PASSWORD",
    "suspendedSessionPassword: process.env.E2E_SUSPENDED_SESSION_PASSWORD",
    "roleChangePassword: process.env.E2E_ROLE_CHANGE_PASSWORD",
    "mfaTotpSecret: process.env.E2E_MFA_TOTP_SECRET",
    'mfaEnabled: true',
    'mfaEnabled: false',
    "totpSecret: parsed.data.mfaTotpSecret",
    'role: "OWNER"',
    'role: "AGENT"',
    "db.user.upsert",
    "db.agent.upsert",
    "upsertSyntheticAgentProfile",
    'preferredName: "Role Change Agent"',
    'status: "OFFBOARDED"',
    "failedLogins: 0",
    "lockedUntil: null",
    "canClaimLeads: false",
  ]) contains(path, expected);

  for (const forbidden of [
    "deleteMany",
    "$executeRaw",
    "$queryRaw",
    "db.lead.",
    "db.clientAccount.",
    "db.serviceCase.",
    "db.commission",
    "db.payout",
    "fetch(",
    "GHL_PRIVATE_TOKEN",
    "crm.mercurycalldesk.com",
    "neon.tech",
  ]) excludes(path, forbidden);
}

function checkPlaywrightConfig() {
  const path = "playwright.auth.config.ts";
  for (const expected of [
    'from "@playwright/test"',
    '"http://127.0.0.1:3000"',
    "localHosts",
    "Authenticated E2E tests may only target a localhost application URL.",
    "if (process.env.VERCEL_ENV)",
    'testDir: "./tests/e2e/auth"',
    "fullyParallel: false",
    "retries: 0",
    "workers: 1",
    'name: "chromium"',
    'command: "npm run dev -- --hostname 127.0.0.1 --port 3000"',
    "reuseExistingServer: !process.env.CI",
  ]) contains(path, expected);

  for (const forbidden of [
    "crm.mercurycalldesk.com",
    "vercel.app",
    "https://",
    "DATABASE_URL",
    "secrets.",
  ]) excludes(path, forbidden);
}

function checkAuthContract() {
  const path = "src/auth.ts";
  for (const expected of [
    "const MAX_FAILED_LOGINS = 5",
    "const LOCKOUT_MINUTES = 15",
    'code = "MFA_REQUIRED"',
    'code = "MFA_INVALID"',
    'code = "ACCOUNT_LOCKED"',
    "failedLogins >= MAX_FAILED_LOGINS",
    "authenticator.check(totp, user.totpSecret)",
    'actionType: "LOGIN_FAILED"',
    'actionType: "ACCOUNT_LOCKED"',
    'actionType: "LOGIN_SUCCESS"',
    'actionType: "LOGOUT"',
    'metadata: { reason }',
    "metadata: { failedLogins }",
    "metadata: { lockedUntil: lockedUntil.toISOString() }",
    "failedLogins: 0",
    "lockedUntil: null",
    "lastLoginAt: now",
  ]) contains(path, expected);
}

function checkLiveAuthorizationContract() {
  const authzPath = "src/lib/authz.ts";
  for (const expected of [
    "const session = await auth()",
    "const userId = session?.user?.id",
    "db.user.findUnique({ where: { id: userId } })",
    'user.status !== "ACTIVE"',
    'redirectToLogin("/login?e=forbidden")',
    "const user = await requireUser()",
    "roles.includes(user.role)",
  ]) contains(authzPath, expected);

  const middlewarePath = "src/auth.config.ts";
  for (const expected of [
    'session: { strategy: "jwt" }',
    'pathname.startsWith("/admin")',
    'pathname.startsWith("/portal")',
    "token.role = user.role",
    "token.status = user.status",
  ]) contains(middlewarePath, expected);
}

function checkLiveSessionMutationHelper() {
  const path = "tests/e2e/auth/disposable-auth-state.ts";
  for (const expected of [
    "ALLOWED_SYNTHETIC_EMAILS",
    "e2e.suspended-session@mercurycalldesk.test",
    "e2e.role-change@mercurycalldesk.test",
    'process.env.E2E_ALLOW_DISPOSABLE_DB === "true"',
    "!process.env.VERCEL_ENV",
    'assertDisposableTarget("DATABASE_URL")',
    'assertDisposableTarget("DIRECT_URL")',
    "LOCAL_DATABASE_HOSTS",
    "database name must contain an isolated e2e token",
    "ALLOWED_SYNTHETIC_EMAILS.has(email)",
    "setSyntheticUserStatus",
    "expireSyntheticLockout",
    "db.user.findUnique",
    "data: { lockedUntil: new Date(0) }",
    'status === "ACTIVE" || status === "SUSPENDED"',
    "setSyntheticUserRole",
    'role === "OWNER" || role === "AGENT"',
    "db.user.update({ where: { email }, data: { status } })",
    "db.user.update({ where: { email }, data: { role } })",
    "closeDisposableAuthState",
  ]) contains(path, expected);

  for (const forbidden of [
    "db.user.create",
    "db.user.upsert",
    "deleteMany",
    "$executeRaw",
    "$queryRaw",
    "$transaction",
    "db.auditLog.",
    "db.lead.",
    "db.agent.",
    "db.clientAccount.",
    "db.serviceCase.",
    "db.commission",
    "db.payout",
    "fetch(",
    "crm.mercurycalldesk.com",
    "vercel.app",
    "neon.tech",
    "GHL_PRIVATE_TOKEN",
  ]) excludes(path, forbidden);
}

function checkBrowserTests() {
  const path = "tests/e2e/auth/authenticated-session.spec.ts";
  for (const expected of [
    'import { authenticator } from "otplib"',
    'from "./disposable-auth-state"',
    "closeDisposableAuthState",
    "expireSyntheticLockout",
    "setSyntheticUserRole",
    "setSyntheticUserStatus",
    "protected Admin and Agent pages redirect unauthenticated visitors to sign in",
    "unknown accounts and wrong passwords share the generic credentials failure",
    "synthetic Owner can sign in, open an Admin control plane, and sign out",
    "synthetic Agent reaches the portal but cannot cross the Admin boundary",
    "suspending the underlying User revokes an already-issued Owner session",
    "changing the underlying role immediately removes Admin access and enables the Agent portal",
    "synthetic MFA Owner requires a code, rejects an invalid code, and accepts the current TOTP",
    "five failed passwords lock the synthetic account and block the correct password",
    "suspended and offboarded accounts reject correct passwords without creating sessions",
    "an expired synthetic lockout accepts the correct password and resets the account",
    'setSyntheticUserStatus(SUSPENDED_SESSION_EMAIL, "SUSPENDED")',
    "expireSyntheticLockout()",
    'setSyntheticUserRole(ROLE_CHANGE_EMAIL, "AGENT")',
    "Welcome back, Role Change Agent",
    '/\\/login\\?e=forbidden/',
    'response.url().includes("/api/auth/callback/credentials")',
    "form [role='alert']",
    'getByLabel("Authentication code")',
    "authenticator.generate(mfaTotpSecret)",
    "for (let attempt = 0; attempt < 5; attempt += 1)",
    "This account is temporarily locked after too many sign-in attempts.",
    "We could not sign you in with those credentials.",
    'page.goto("/admin/build-guards")',
    'page.goto("/portal")',
    'getByRole("button", { name: "Sign out" })',
    'data-build-guard-entry="build-guard-registry"',
    "e2e.owner@mercurycalldesk.test",
    "e2e.agent@mercurycalldesk.test",
    "e2e.mfa@mercurycalldesk.test",
    "e2e.lockout@mercurycalldesk.test",
    "e2e.lockout-recovery@mercurycalldesk.test",
    "e2e.offboarded@mercurycalldesk.test",
    "e2e.suspended-session@mercurycalldesk.test",
    "e2e.role-change@mercurycalldesk.test",
  ]) contains(path, expected);

  for (const forbidden of [
    "crm.mercurycalldesk.com",
    "vercel.app",
    "https://",
    "request.post(",
    "/api/signup",
    "/api/activate",
    "/api/cron/",
    "/api/ghl/",
    "/api/lead-imports",
  ]) excludes(path, forbidden);
}

function checkPersistedSecurityAssertions() {
  const path = "scripts/assert-auth-e2e-security-state.ts";
  for (const expected of [
    "Authenticated E2E persisted security state passed.",
    'process.env.E2E_ALLOW_DISPOSABLE_DB === "true"',
    "!process.env.VERCEL_ENV",
    'assertDisposableDatabase("DATABASE_URL")',
    'assertDisposableDatabase("DIRECT_URL")',
    "LOCAL_DATABASE_HOSTS",
    "database name must contain an isolated e2e token",
    "db.user.findUnique",
    "db.auditLog.findMany",
    'actionType: { in: ["LOGIN_FAILED", "ACCOUNT_LOCKED", "LOGIN_SUCCESS", "LOGOUT"] }',
    'entityType: "User"',
    "failedLogins === 0",
    'actions.includes("LOGIN_FAILED")',
    'actions.includes("LOGIN_SUCCESS")',
    'actions.includes("LOGOUT")',
    'mfaFailureReasons.includes("MFA_REQUIRED")',
    'mfaFailureReasons.includes("MFA_INVALID")',
    "lockoutUser.failedLogins === 5",
    "lockoutUser.lockedUntil.getTime() > Date.now()",
    "failures.length === 5",
    "locks.length === 1",
    "JSON.stringify([1, 2, 3, 4, 5])",
    "lockMetadata.lockedUntil === lockoutUser.lockedUntil.toISOString()",
    "assertLockoutRecoveryState",
    "recoveryUser.failedLogins === 0 && recoveryUser.lockedUntil === null",
    "assertOffboardedState",
    'offboardedUser.status === "OFFBOARDED"',
    "assertSuspendedSessionState",
    'suspendedUser.status === "SUSPENDED"',
    "assertRoleChangeState",
    'roleChangeUser.role === "AGENT"',
    'entry.actionType === "LOGIN_SUCCESS" && entry.actorRole === "OWNER"',
  ]) contains(path, expected);

  for (const forbidden of [
    "db.user.create",
    "db.user.update",
    "db.user.upsert",
    "db.auditLog.create",
    "db.auditLog.update",
    "deleteMany",
    "$executeRaw",
    "$queryRaw",
    "$transaction",
    "db.lead.",
    "db.agent.",
    "db.clientAccount.",
    "db.serviceCase.",
    "db.commission",
    "db.payout",
    "fetch(",
    "crm.mercurycalldesk.com",
    "vercel.app",
    "neon.tech",
    "GHL_PRIVATE_TOKEN",
  ]) excludes(path, forbidden);
}

function checkRepositoryWiring() {
  for (const [path, expected] of [
    ["package.json", '"seed:e2e-auth": "tsx scripts/seed-auth-e2e.ts"'],
    ["package.json", '"test:e2e:auth": "playwright test --config=playwright.auth.config.ts"'],
    ["package.json", '"assert:e2e-auth-security": "tsx scripts/assert-auth-e2e-security-state.ts"'],
    ["package.json", '"check:auth-e2e-foundation": "tsx scripts/check-authenticated-e2e-foundation.ts"'],
    ["package.json", '"@playwright/test"'],
    ["docs/AUTHENTICATED_E2E.md", "localhost-only"],
    ["docs/AUTHENTICATED_E2E.md", "MFA"],
    ["docs/AUTHENTICATED_E2E.md", "lockout"],
    ["docs/AUTHENTICATED_E2E.md", "Persisted security evidence"],
    ["docs/AUTHENTICATED_E2E.md", "Live session enforcement"],
    ["docs/INDEX.md", "AUTHENTICATED_E2E.md"],
    ["src/lib/lead-deployment-verification.ts", "Authenticated E2E foundation guard passed."],
    ["scripts/check-deployment-verification-guard.ts", "Authenticated E2E foundation guard passed."],
  ] as const) contains(path, expected);
}

function main() {
  checkWorkflow();
  checkSeed();
  checkPlaywrightConfig();
  checkAuthContract();
  checkLiveAuthorizationContract();
  checkLiveSessionMutationHelper();
  checkBrowserTests();
  checkPersistedSecurityAssertions();
  checkRepositoryWiring();
  console.log("Authenticated E2E foundation guard passed.");
}

main();
