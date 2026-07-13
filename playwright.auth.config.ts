import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const parsedBaseUrl = new URL(baseURL);
const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);

if (!localHosts.has(parsedBaseUrl.hostname)) {
  throw new Error("Authenticated E2E tests may only target a localhost application URL.");
}
if (process.env.VERCEL_ENV) {
  throw new Error("Authenticated E2E tests are forbidden in Vercel environments.");
}

export default defineConfig({
  testDir: "./tests/e2e/auth",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      E2E_BASE_URL: baseURL,
    },
  },
});
