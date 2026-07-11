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
];

const guards: [string, string][] = [
  ["src/app/admin/leads/deployment-verification/page.tsx", "data-deployment-verification=\"lead-flow\""],
  ["src/app/admin/leads/deployment-verification/page.tsx", "Deployment verification"],
  ["src/app/admin/leads/deployment-verification/page.tsx", "Read-only Vercel deployment status snapshot"],
  ["src/app/admin/leads/deployment-verification/page.tsx", "VERCEL_GIT_COMMIT_SHA"],
  ["src/app/admin/leads/deployment-verification/page.tsx", "VERCEL_ENV"],
  ["src/app/admin/leads/deployment-verification/page.tsx", "VERCEL_DEPLOYMENT_ID"],
  ["src/app/admin/leads/deployment-verification/page.tsx", "Open /api/status"],
  ["src/app/admin/leads/deployment-verification/page.tsx", "Expected guard-pass lines"],
  ["src/app/admin/leads/deployment-verification/page.tsx", "data-deployment-verification-row={row.id}"],
  ["src/lib/lead-acceptance-overview.ts", "deployment-verification"],
  ["src/lib/lead-acceptance-overview.ts", "/admin/leads/deployment-verification"],
  ["src/app/admin/leads/acceptance-overview/page.tsx", "/admin/leads/deployment-verification"],
  ...expectedGuardLines.map((line): [string, string] => ["src/app/admin/leads/deployment-verification/page.tsx", line]),
];

for (const [path, expected] of guards) {
  assertContains(path, expected);
}

console.log("Deployment verification guard passed.");
