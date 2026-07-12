const baseUrl = (process.env.PRODUCTION_BASE_URL || "https://crm.mercurycalldesk.com").replace(/\/$/, "");
const expectedCommit = process.env.EXPECTED_COMMIT_SHA || process.env.GITHUB_SHA || "";
const maxAttempts = Number(process.env.SMOKE_MAX_ATTEMPTS || 30);
const intervalMs = Number(process.env.SMOKE_INTERVAL_MS || 10_000);

if (!expectedCommit) {
  throw new Error("EXPECTED_COMMIT_SHA or GITHUB_SHA is required.");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function waitForExpectedProductionCommit() {
  let lastObserved = "unavailable";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/api/status`, {
        headers: { Accept: "application/json", "User-Agent": "mcd-production-smoke" },
        cache: "no-store",
      });

      if (!response.ok) {
        lastObserved = `HTTP ${response.status}`;
      } else {
        const payload = await response.json();
        const commitSha = payload?.git?.commitSha || null;
        lastObserved = commitSha || "missing commit SHA";

        const cacheControl = response.headers.get("cache-control") || "";
        if (!cacheControl.toLowerCase().includes("no-store")) {
          throw new Error(`/api/status must be no-store; received ${cacheControl || "no header"}.`);
        }

        if (
          payload?.ok === true &&
          payload?.service === "crm-mcd" &&
          payload?.environment === "production" &&
          payload?.git?.branch === "main" &&
          commitSha === expectedCommit
        ) {
          console.log(`Production status matched ${expectedCommit} on attempt ${attempt}.`);
          return payload;
        }
      }
    } catch (error) {
      lastObserved = error instanceof Error ? error.message : String(error);
    }

    if (attempt < maxAttempts) {
      console.log(`Production not ready yet (${lastObserved}); retrying ${attempt}/${maxAttempts}.`);
      await sleep(intervalMs);
    }
  }

  throw new Error(`Production did not report expected commit ${expectedCommit}. Last observed: ${lastObserved}`);
}

const protectedChecks = [
  { path: "/admin/command-center", forbidden: ["Command center", "Registered agents"] },
  { path: "/admin/project-readiness", forbidden: ["Project readiness control plane", "Commission enum contract"] },
  { path: "/admin/servicing/acceptance-command-center", forbidden: ["Servicing acceptance command center", "Owner authorization boundary"] },
  { path: "/api/admin/project-readiness", forbidden: ["\"schema\"", "\"modules\""] },
  { path: "/api/admin/servicing/acceptance-readiness", forbidden: ["\"decision\"", "\"queues\""] },
];

async function assertProtectedBoundary({ path, forbidden }) {
  const response = await fetchWithTimeout(`${baseUrl}${path}`, {
    redirect: "manual",
    headers: { Accept: "text/html,application/json", "User-Agent": "mcd-production-smoke" },
    cache: "no-store",
  });

  const location = response.headers.get("location") || "";
  if (response.status >= 300 && response.status < 400 && location.includes("/login")) {
    console.log(`${path}: protected redirect to login (${response.status}).`);
    return;
  }

  if (response.status === 401 || response.status === 403) {
    console.log(`${path}: protected response (${response.status}).`);
    return;
  }

  const contentType = response.headers.get("content-type") || "";
  const body = await response.text();
  const leakedMarker = forbidden.find((marker) => body.includes(marker));

  if (leakedMarker) {
    throw new Error(`${path} exposed protected marker to an unauthenticated request: ${leakedMarker}`);
  }

  if (response.status === 200 && contentType.includes("text/html") && body.includes("Sign in")) {
    console.log(`${path}: protected sign-in boundary rendered.`);
    return;
  }

  throw new Error(`${path} did not enforce the expected unauthenticated boundary. HTTP ${response.status}, content-type ${contentType || "missing"}.`);
}

await waitForExpectedProductionCommit();
for (const check of protectedChecks) {
  await assertProtectedBoundary(check);
}

console.log("Production smoke checks passed.");
