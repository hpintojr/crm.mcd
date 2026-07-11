import { readFileSync } from "node:fs";

function assertContains(path: string, expected: string) {
  const content = readFileSync(path, "utf8");
  if (!content.includes(expected)) {
    throw new Error(`${path} is missing required acceptance diff guard: ${expected}`);
  }
}

const guards: [string, string][] = [
  ["src/app/admin/leads/acceptance-diff/page.tsx", "data-acceptance-diff=\"lead-flow\""],
  ["src/app/admin/leads/acceptance-diff/page.tsx", "Lead acceptance diff"],
  ["src/app/admin/leads/acceptance-diff/page.tsx", "Read-only comparison between the required Lead Flow acceptance contract"],
  ["src/app/admin/leads/acceptance-diff/page.tsx", "Commit and catalog diff"],
  ["src/app/admin/leads/acceptance-diff/page.tsx", "Evidence diff"],
  ["src/app/admin/leads/acceptance-diff/page.tsx", "getLeadAcceptanceHandoffPacket"],
  ["src/app/admin/leads/acceptance-diff/page.tsx", "LEAD_ACCEPTANCE_FINDINGS_LATEST_PRODUCTION_COMMIT"],
  ["src/app/admin/leads/acceptance-diff/page.tsx", "LEAD_STATUS_BASELINE_COMMIT"],
  ["src/app/admin/leads/acceptance-diff/page.tsx", "data-acceptance-diff-row={row.id}"],
  ["src/app/admin/leads/acceptance-diff/page.tsx", "DEPLOYMENT_AHEAD_OF_CATALOG"],
  ["src/app/admin/leads/acceptance-diff/page.tsx", "/admin/leads/deep-links#acceptance-diff"],
  ["src/app/admin/leads/acceptance-diff/page.tsx", "Deep link anchor"],
  ["src/lib/lead-acceptance-overview.ts", "acceptance-diff"],
  ["src/lib/lead-acceptance-overview.ts", "/admin/leads/acceptance-diff"],
];

for (const [path, expected] of guards) {
  assertContains(path, expected);
}

console.log("Acceptance diff guard passed.");
