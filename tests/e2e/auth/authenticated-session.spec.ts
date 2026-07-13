import { expect, test, type Page } from "@playwright/test";
import { authenticator } from "otplib";

const OWNER_EMAIL = "e2e.owner@mercurycalldesk.test";
const AGENT_EMAIL = "e2e.agent@mercurycalldesk.test";
const MFA_EMAIL = "e2e.mfa@mercurycalldesk.test";
const LOCKOUT_EMAIL = "e2e.lockout@mercurycalldesk.test";
const UNKNOWN_EMAIL = "e2e.unknown@mercurycalldesk.test";

const ownerPassword = process.env.E2E_OWNER_PASSWORD;
const agentPassword = process.env.E2E_AGENT_PASSWORD;
const mfaPassword = process.env.E2E_MFA_PASSWORD;
const lockoutPassword = process.env.E2E_LOCKOUT_PASSWORD;
const mfaTotpSecret = process.env.E2E_MFA_TOTP_SECRET;

if (!ownerPassword || !agentPassword || !mfaPassword || !lockoutPassword || !mfaTotpSecret) {
  throw new Error("Synthetic passwords and the MFA TOTP secret are required for authenticated browser tests.");
}

async function submitCredentials(page: Page) {
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" && response.url().includes("/api/auth/callback/credentials"),
      { timeout: 20_000 },
    ),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);
}

async function fillCredentials(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
}

async function signIn(page: Page, email: string, password: string, expectedPath: RegExp) {
  await page.goto("/login");
  await fillCredentials(page, email, password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(expectedPath, { timeout: 20_000 });
}

function invalidCurrentTotp(secret: string) {
  const valid = authenticator.generate(secret);
  const replacement = valid[0] === "9" ? "0" : String(Number(valid[0]) + 1);
  return `${replacement}${valid.slice(1)}`;
}

test("protected Admin and Agent pages redirect unauthenticated visitors to sign in", async ({ page }) => {
  await page.goto("/admin/build-guards");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page.goto("/portal");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("unknown accounts and wrong passwords share the generic credentials failure", async ({ page }) => {
  await page.goto("/login");
  await fillCredentials(page, UNKNOWN_EMAIL, "Unknown-E2E-Only-2026!");
  await submitCredentials(page);
  await expect(page.getByRole("alert")).toHaveText("We could not sign you in with those credentials.");

  await fillCredentials(page, OWNER_EMAIL, "Wrong-E2E-Password-2026!");
  await submitCredentials(page);
  await expect(page.getByRole("alert")).toHaveText("We could not sign you in with those credentials.");
});

test("synthetic Owner can sign in, open an Admin control plane, and sign out", async ({ page }) => {
  await signIn(page, OWNER_EMAIL, ownerPassword, /\/admin(?:\?|$)/);
  await expect(page.getByRole("heading", { name: "Applicant review" })).toBeVisible();

  await page.goto("/admin/build-guards");
  await expect(page.getByRole("heading", { name: "Build guard registry" })).toBeVisible();
  await expect(page.getByText("Registered guards")).toBeVisible();
  await expect(page.locator('[data-build-guard-entry="build-guard-registry"]')).toBeVisible();

  await page.goto("/admin");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 20_000 });

  await page.goto("/admin/build-guards");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
});

test("synthetic Agent reaches the portal but cannot cross the Admin boundary", async ({ page }) => {
  await signIn(page, AGENT_EMAIL, agentPassword, /\/portal(?:\?|$)/);
  await expect(page.getByRole("heading", { name: "Welcome back, E2E Agent" })).toBeVisible();

  await page.goto("/admin/build-guards");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page.goto("/portal");
  await expect(page.getByRole("heading", { name: "Welcome back, E2E Agent" })).toBeVisible();
});

test("synthetic MFA Owner requires a code, rejects an invalid code, and accepts the current TOTP", async ({ page }) => {
  await page.goto("/login");
  await fillCredentials(page, MFA_EMAIL, mfaPassword);
  await submitCredentials(page);

  await expect(page.getByRole("alert")).toHaveText("Enter the six-digit code from your authenticator app.");
  await expect(page.getByLabel("Authentication code")).toBeVisible();

  await page.getByLabel("Authentication code").fill(invalidCurrentTotp(mfaTotpSecret));
  await submitCredentials(page);
  await expect(page.getByRole("alert")).toHaveText("That authentication code is not valid. Try again.");

  await page.getByLabel("Authentication code").fill(authenticator.generate(mfaTotpSecret));
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin(?:\?|$)/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Applicant review" })).toBeVisible();
});

test("five failed passwords lock the synthetic account and block the correct password", async ({ page }) => {
  await page.goto("/login");
  await fillCredentials(page, LOCKOUT_EMAIL, "Wrong-E2E-Password-2026!");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await submitCredentials(page);
    await expect(page.getByRole("alert")).toHaveText("We could not sign you in with those credentials.");
  }

  await page.getByLabel("Password").fill(lockoutPassword);
  await submitCredentials(page);
  await expect(page.getByRole("alert")).toHaveText(
    "This account is temporarily locked after too many sign-in attempts.",
  );
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
});
