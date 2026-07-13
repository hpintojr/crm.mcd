import { readFileSync } from "node:fs";

/* BUILD_GUARD_REGISTRY_EVIDENCE_START
Lead import response boundary checks passed.
Lead flow alignment guard passed.
Owner decision prep guard passed.
Deferred acceptance runbook guard passed.
Acceptance summary CSV guard passed.
Print runbook guard passed.
Controlled test data history guard passed.
Acceptance diff guard passed.
Overview deferred summary guard passed.
Deployment verification guard passed.
Deep links guard passed.
Deep links API guard passed.
Deployment verification API guard passed.
Controlled warm reply guard passed.
Latest production commit guard passed.
Appointment Closed Won guard passed.
Commission schema migration guard passed.
Project readiness guard passed.
Servicing acceptance preflight guard passed.
Production smoke automation guard passed.
Lead aging cron resilience guard passed.
HTTP security headers guard passed.
Auth telemetry hygiene guard passed.
Certification precondition UX guard passed.
Manager claim action boundary guard passed.
Route trace hygiene guard passed.
Public signup boundary guard passed.
Account activation boundary guard passed.
GHL webhook replay claim guard passed.
GHL webhook request boundary guard passed.
Portal write request boundary guard passed.
Admin controlled test request boundary guard passed.
Legacy Admin Lead import retirement guard passed.
Integration health control plane guard passed.
Admin read report response boundary guard passed.
Lead acceptance report response boundary guard passed.
Protected CSV download response boundary guard passed.
Admin Lead import request boundary guard passed.
Route boundary registry guard passed.
Route boundary control plane guard passed.
Signed Lead import domain error mapping guard passed.
Shared route JSON response boundary guard passed.
Public JSON body boundary guard passed.
Build guard registry guard passed.
BUILD_GUARD_REGISTRY_EVIDENCE_END */

function assertContains(path: string, expected: string) {
  const content = readFileSync(path, "utf8");
  if (!content.includes(expected)) {
    throw new Error(`${path} is missing required deployment verification guard: ${expected}`);
  }
}

type RegisteredGuard = {
  passLine: string;
  exposeInDeploymentVerification: boolean;
};

const registry = JSON.parse(readFileSync("config/build-guard-registry.json", "utf8")) as {
  version: string;
  guards: RegisteredGuard[];
};
const expectedGuardLines = registry.guards
  .filter((guard) => guard.exposeInDeploymentVerification)
  .map((guard) => guard.passLine);

if (registry.version !== "2026-07-13-pr131") {
  throw new Error("Deployment verification must use the PR131 build guard registry.");
}
if (expectedGuardLines.length !== 44) {
  throw new Error("Deployment verification must expose the exact 44 registered pass lines.");
}
if (!expectedGuardLines.includes("Deployment verification guard passed.")) {
  throw new Error("Deployment verification guard must remain registered.");
}
if (!expectedGuardLines.includes("Build guard registry guard passed.")) {
  throw new Error("Build guard registry self-validation must be deployment-visible.");
}

const guards: [string, string][] = [
  ["src/app/admin/leads/deployment-verification/page.tsx", "data-deployment-verification=\"lead-flow\""],
  ["src/app/admin/leads/deployment-verification/page.tsx", "Deployment verification"],
  ["src/app/admin/leads/deployment-verification/page.tsx", "Read-only Vercel deployment status snapshot"],
  ["src/app/admin/leads/deployment-verification/page.tsx", "getLeadDeploymentVerificationSnapshot"],
  ["src/app/admin/leads/deployment-verification/page.tsx", "/api/admin/leads/deployment-verification"],
  ["src/app/admin/leads/deployment-verification/page.tsx", "JSON API"],
  ["src/app/admin/leads/deployment-verification/page.tsx", "Open /api/status"],
  ["src/app/admin/leads/deployment-verification/page.tsx", "Expected guard-pass lines"],
  ["src/app/admin/leads/deployment-verification/page.tsx", "data-deployment-verification-row={row.id}"],
  ["src/app/admin/leads/deployment-verification/page.tsx", "/admin/leads/deep-links#deployment-verification"],
  ["src/app/admin/leads/deployment-verification/page.tsx", "Deep link anchor"],
  ["src/lib/lead-deployment-verification.ts", "VERCEL_GIT_COMMIT_SHA"],
  ["src/lib/lead-deployment-verification.ts", "VERCEL_ENV"],
  ["src/lib/lead-deployment-verification.ts", "VERCEL_DEPLOYMENT_ID"],
  ["src/lib/lead-deployment-verification.ts", "DEPLOYMENT_GUARD_PASS_LINES"],
  ["src/lib/lead-deployment-verification.ts", "EXPECTED_LEAD_FLOW_GUARD_LINES"],
  ["src/lib/lead-deployment-verification.ts", "getLeadDeploymentVerificationSnapshot"],
  ["src/lib/build-guard-registry.ts", "DEPLOYMENT_GUARD_PASS_LINES"],
  ["src/lib/lead-acceptance-overview.ts", "deployment-verification"],
  ["src/lib/lead-acceptance-overview.ts", "/admin/leads/deployment-verification"],
  ["src/app/admin/leads/acceptance-overview/page.tsx", "/admin/leads/deployment-verification"],
  ["docs/BUILD_GUARD_REGISTRY.md", "Single source of truth"],
  ["docs/INDEX.md", "BUILD_GUARD_REGISTRY.md"],
];

for (const [path, expected] of guards) {
  assertContains(path, expected);
}

console.log("Deployment verification guard passed.");
