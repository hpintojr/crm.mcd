import { appendFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

type StatusPayload = {
  ok?: unknown;
  service?: unknown;
  environment?: unknown;
  git?: {
    branch?: unknown;
    commitSha?: unknown;
    commitMessage?: unknown;
  };
  deployment?: unknown;
  timestamp?: unknown;
};

type SmokeResult = {
  check: string;
  target: string;
  detail: string;
};

const baseUrl = normalizeBaseUrl(process.env.PRODUCTION_BASE_URL ?? "https://crm.mercurycalldesk.com");
const expectedCommitSha = cleanOptional(process.env.EXPECTED_COMMIT_SHA);
const maxAttempts = positiveInteger(process.env.SMOKE_MAX_ATTEMPTS, 30, 1, 60);
const retrySeconds = positiveInteger(process.env.SMOKE_RETRY_SECONDS, 15, 1, 60);
const requestTimeoutMs = positiveInteger(process.env.SMOKE_REQUEST_TIMEOUT_MS, 15_000, 1_000, 60_000);
const results: SmokeResult[] = [];

function normalizeBaseUrl(value: string) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") throw new Error("PRODUCTION_BASE_URL must use HTTPS.");
  parsed.pathname = "/";
  parsed.search = "";
  parsed.hash = "";
  return parsed;
}

function cleanOptional(value: string | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function positiveInteger(value: string | undefined, fallback: number, min: number, max: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`Expected an integer between ${min} and ${max}, received ${value}.`);
  }
  return parsed;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function target(path: string) {
  return new URL(path, baseUrl).toString();
}

async function fetchWithTimeout(path: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    return await fetch(target(path), {
      cache: "no-store",
      redirect: "follow",
      headers: {
        Accept: "*/*",
        "User-Agent": "Mercury-Call-Desk-Production-Smoke/1.0",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function validateSecurityHeaders(response: Response, label: string) {
  const contentSecurityPolicy = response.headers.get("content-security-policy") ?? "";
  const permissionsPolicy = response.headers.get("permissions-policy") ?? "";
  const strictTransportSecurity = response.headers.get("strict-transport-security") ?? "";

  assert(contentSecurityPolicy.includes("base-uri 'self'"), `${label} is missing the CSP base-uri policy.`);
  assert(contentSecurityPolicy.includes("form-action 'self'"), `${label} is missing the CSP form-action policy.`);
  assert(contentSecurityPolicy.includes("frame-ancestors 'none'"), `${label} is missing the CSP anti-framing policy.`);
  assert(contentSecurityPolicy.includes("object-src 'none'"), `${label} is missing the CSP object policy.`);
  assert(response.headers.get("x-powered-by") === null, `${label} must not disclose the Next.js framework header.`);
  assert(response.headers.get("x-content-type-options") === "nosniff", `${label} is missing X-Content-Type-Options: nosniff.`);
  assert(response.headers.get("x-frame-options") === "DENY", `${label} is missing X-Frame-Options: DENY.`);
  assert(response.headers.get("referrer-policy") === "strict-origin-when-cross-origin", `${label} has an unexpected Referrer-Policy.`);
  assert(response.headers.get("cross-origin-opener-policy") === "same-origin-allow-popups", `${label} has an unexpected Cross-Origin-Opener-Policy.`);
  assert(response.headers.get("x-dns-prefetch-control") === "off", `${label} is missing X-DNS-Prefetch-Control: off.`);
  assert(response.headers.get("x-permitted-cross-domain-policies") === "none", `${label} is missing the cross-domain policy header.`);
  assert(response.headers.get("x-download-options") === "noopen", `${label} is missing X-Download-Options: noopen.`);
  for (const directive of ["camera=()", "microphone=()", "geolocation=()", "payment=()", "usb=()", "browsing-topics=()"]) {
    assert(permissionsPolicy.includes(directive), `${label} is missing Permissions-Policy directive ${directive}.`);
  }
  assert(strictTransportSecurity.includes("max-age="), `${label} is missing Strict-Transport-Security.`);
}

function validateStatusPayload(payload: StatusPayload, response: Response) {
  assert(response.status === 200, `/api/status returned HTTP ${response.status}.`);
  assert(response.headers.get("content-type")?.includes("application/json"), "/api/status did not return JSON.");
  assert(response.headers.get("cache-control")?.includes("no-store"), "/api/status must remain no-store.");
  assert(response.headers.get("x-robots-tag") === "noindex, nofollow, noarchive", "/api/status must remain excluded from indexing.");
  validateSecurityHeaders(response, "/api/status");
  assert(payload.ok === true, "/api/status did not report ok=true.");
  assert(payload.service === "crm-mcd", "/api/status reported an unexpected service name.");
  assert(payload.environment === "production", `/api/status reported environment=${String(payload.environment)}.`);
  assert(payload.git?.branch === "main", `/api/status reported branch=${String(payload.git?.branch)}.`);
  assert(
    typeof payload.git?.commitSha === "string" && /^[0-9a-f]{40}$/i.test(payload.git.commitSha),
    "/api/status did not expose a valid 40-character commit SHA.",
  );
  assert(!payload.git || !("commitMessage" in payload.git), "/api/status must not expose commit messages.");
  assert(!("deployment" in payload), "/api/status must not expose deployment hostnames or regions.");
  assert(!("timestamp" in payload), "/api/status must not expose per-request timestamps.");
}

async function waitForExpectedDeployment() {
  let lastObservedSha = "unknown";
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout("/api/status");
      const payload = (await response.json()) as StatusPayload;
      validateStatusPayload(payload, response);
      lastObservedSha = String(payload.git?.commitSha);

      if (expectedCommitSha && lastObservedSha !== expectedCommitSha) {
        throw new Error(`Production is still on ${lastObservedSha}; waiting for ${expectedCommitSha}.`);
      }

      results.push({
        check: "Deployment status",
        target: "/api/status",
        detail: `${lastObservedSha.slice(0, 12)} on main in production`,
      });
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === maxAttempts) break;
      console.log(`[production-smoke] attempt ${attempt}/${maxAttempts}: ${lastError.message}`);
      await sleep(retrySeconds * 1_000);
    }
  }

  throw new Error(
    `Production deployment did not become ready after ${maxAttempts} attempts. Last observed SHA: ${lastObservedSha}. Last error: ${lastError?.message ?? "unknown"}`,
  );
}

async function checkLoginSurface() {
  const response = await fetchWithTimeout("/login");
  const html = await response.text();
  assert(response.status === 200, `/login returned HTTP ${response.status}.`);
  assert(response.headers.get("content-type")?.includes("text/html"), "/login did not return HTML.");
  validateSecurityHeaders(response, "/login");
  assert(html.includes("Mercury Call Desk"), "/login is missing the Mercury Call Desk identity.");
  assert(html.includes(">Sign in<"), "/login is missing the sign-in heading.");
  assert(html.includes('name="robots"'), "/login is missing the robots meta tag.");
  assert(html.includes('content="noindex, nofollow"'), "/login must remain noindex, nofollow.");
  results.push({ check: "Login and security headers", target: "/login", detail: "HTTP 200, branded, noindex, hardened headers" });
}

async function checkProtectedBoundary(path: string, forbiddenMarkers: string[]) {
  const response = await fetchWithTimeout(path);
  const html = await response.text();
  const finalPath = new URL(response.url).pathname;
  const matchedPath = response.headers.get("x-matched-path");

  assert(response.status === 200, `${path} returned HTTP ${response.status}.`);
  assert(response.headers.get("content-type")?.includes("text/html"), `${path} did not resolve to the login HTML boundary.`);
  validateSecurityHeaders(response, path);
  assert(finalPath === "/login" || matchedPath === "/login", `${path} did not resolve to /login for an unauthenticated request.`);
  assert(html.includes(">Sign in<"), `${path} did not return the secure sign-in surface.`);
  for (const marker of forbiddenMarkers) {
    assert(!html.includes(marker), `${path} leaked protected marker: ${marker}`);
  }

  results.push({ check: "Protected boundary", target: path, detail: "Unauthenticated request resolves to /login with hardened headers" });
}

async function writeStepSummary() {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  const rows = results.map((result) => `| ${result.check} | \`${result.target}\` | ${result.detail} |`).join("\n");
  await appendFile(
    summaryPath,
    `## Mercury Call Desk production smoke\n\n| Check | Target | Result |\n|---|---|---|\n${rows}\n\nExpected commit: \`${expectedCommitSha ?? "current main deployment"}\`\n`,
    "utf8",
  );
}

async function main() {
  if (expectedCommitSha) {
    assert(/^[0-9a-f]{40}$/i.test(expectedCommitSha), "EXPECTED_COMMIT_SHA must be a 40-character Git SHA.");
  }
  console.log(`[production-smoke] target=${baseUrl.toString()} expected=${expectedCommitSha ?? "current production"}`);
  await waitForExpectedDeployment();
  await checkLoginSurface();
  await checkProtectedBoundary("/admin/project-readiness", [
    'data-project-readiness="mcd-control-plane"',
    "Project readiness control plane",
  ]);
  await checkProtectedBoundary("/api/admin/project-readiness", [
    "2026-07-12-pr101",
    "CommissionLedgerEntry",
  ]);
  await checkProtectedBoundary("/admin/servicing/acceptance-command-center", [
    'data-servicing-acceptance-command-center="read-only"',
    "Servicing acceptance command center",
  ]);
  await checkProtectedBoundary("/api/admin/servicing/acceptance-readiness", [
    "2026-07-12-pr102",
    "OWNER_AUTHORIZATION_REQUIRED",
  ]);
  await writeStepSummary();
  console.log(`[production-smoke] passed ${results.length} checks.`);
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(`[production-smoke] FAILED\n${message}`);
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    await appendFile(summaryPath, `## Production smoke failed\n\n\`\`\`text\n${message}\n\`\`\`\n`, "utf8").catch(() => undefined);
  }
  process.exitCode = 1;
});
