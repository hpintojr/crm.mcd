import { expect, test, type Page } from "@playwright/test";

const OWNER_EMAIL = "e2e.owner@mercurycalldesk.test";
const AGENT_EMAIL = "e2e.agent@mercurycalldesk.test";
const ownerPassword = process.env.E2E_OWNER_PASSWORD;
const agentPassword = process.env.E2E_AGENT_PASSWORD;

if (!ownerPassword || !agentPassword) {
  throw new Error("E2E_OWNER_PASSWORD and E2E_AGENT_PASSWORD are required for authenticated browser tests.");
}

async function signIn(page: Page, email: string, password: string, expectedPath: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(expectedPath, { timeout: 20_000 });
}

test("protected Admin and Agent pages redirect unauthenticated visitors to sign in", async ({ page }) => {
  await page.goto("/admin/build-guards");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page.goto("/portal");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
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
