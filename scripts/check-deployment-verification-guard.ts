import { readFileSync } from "node:fs";

function assertContains(path: string, expected: string) {
  const content = readFileSync(path, "utf8");
  if (!content.includes(expected)) {
    throw new Error(`${path} is missing required deployment verification guard: ${expected}`);
  }
}

const expectedGuardLines = [
  "Lead flow alignment guard passed.",
  "Owner decision prep guard passed.",
  "Deferred acceptance runbook guard passed.",
  "Acceptance summary CSV guard passed.",
  "Print runbook guard passed.",
  "Controlled test data history guard passed.",
  "Acceptance diff guard passed.",
  "Overview deferred summary guard passed.",
  "Deployment verification guard passed.",
  "Deep links guard passed.",
  "Deep links API guard passed.",
  "Deployment verification API guard passed.",
  "Controlled warm reply guard passed.",
  "Latest production commit guard passed.",
  "Appointment Closed Won guard passed.",
  "Commission schema migration guard passed.",
  "Project readiness guard passed.",
  "Servicing acceptance preflight guard passed.",
  "Production smoke automation guard passed.",
  "Lead aging cron resilience guard passed.",
];

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
  ["src/lib/lead-deployment-verification.ts", "EXPECTED_LEAD_FLOW_GUARD_LINES"],
  ["src/lib/lead-deployment-verification.ts", "getLeadDeploymentVerificationSnapshot"],
  ["src/lib/lead-acceptance-overview.ts", "deployment-verification"],
  ["src/lib/lead-acceptance-overview.ts", "/admin/leads/deployment-verification"],
  ["src/app/admin/leads/acceptance-overview/page.tsx", "/admin/leads/deployment-verification"],
  ...expectedGuardLines.map((line): [string, string] => ["src/lib/lead-deployment-verification.ts", line]),
];

for (const [path, expected] of guards) {
  assertContains(path, expected);
}

console.log("Deployment verification guard passed.");
