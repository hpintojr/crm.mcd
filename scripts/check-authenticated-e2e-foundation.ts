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
    "E2E_MFA_TOTP_SECRET: JBSWY3DPEHPK3PXP",
    'LEADS_ENABLED: "false"',
    'SERVICING_ENABLED: "false"',
    'COMMISSIONS_ENABLED: "false"',
    'FINANCE_ENABLED: "false"',
    "npx prisma db push",
    "npm run seed:e2e-auth",
    "npx playwright install --with-deps chromium",
    "npm run test:e2e:auth",
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
    "mfaTotpSecret: process.env.E2E_MFA_TOTP_SECRET",
    'mfaEnabled: true',
    'mfaEnabled: false',
    "totpSecret: parsed.data.mfaTotpSecret",
    'role: "OWNER"',
    'role: "AGENT"',
    "db.user.upsert",
    "db.agent.upsert",
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
    'actionType: "ACCOUNT_LOCKED"',
    "failedLogins: 0",
    "lockedUntil: null",
  ]) contains(path, expected);
}

function checkBrowserTests() {
  const path = "tests/e2e/auth/authenticated-session.spec.ts";
  for (const expected of [
    'import { authenticator } from "otplib"',
    "protected Admin and Agent pages redirect unauthenticated visitors to sign in",
    "unknown accounts and wrong passwords share the generic credentials failure",
    "synthetic Owner can sign in, open an Admin control plane, and sign out",
    "synthetic Agent reaches the portal but cannot cross the Admin boundary",
    "synthetic MFA Owner requires a code, rejects an invalid code, and accepts the current TOTP",
    "five failed passwords lock the synthetic account and block the correct password",
    'response.url().includes("/api/auth/callback/credentials")',
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

function checkRepositoryWiring() {
  for (const [path, expected] of [
    ["package.json", '"seed:e2e-auth": "tsx scripts/seed-auth-e2e.ts"'],
    ["package.json", '"test:e2e:auth": "playwright test --config=playwright.auth.config.ts"'],
    ["package.json", '"check:auth-e2e-foundation": "tsx scripts/check-authenticated-e2e-foundation.ts"'],
    ["package.json", '"@playwright/test"'],
    ["docs/AUTHENTICATED_E2E.md", "localhost-only"],
    ["docs/AUTHENTICATED_E2E.md", "MFA"],
    ["docs/AUTHENTICATED_E2E.md", "lockout"],
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
  checkBrowserTests();
  checkRepositoryWiring();
  console.log("Authenticated E2E foundation guard passed.");
}

main();
