import { readFileSync } from "node:fs";

function assertContains(path: string, expected: string) {
  const content = readFileSync(path, "utf8");
  if (!content.includes(expected)) {
    throw new Error(`${path} is missing required deep-links API guard: ${expected}`);
  }
}

const deepLinkSlugs = [
  "owner-decision-prep",
  "acceptance-diff",
  "deferred-runbook",
  "print-runbook",
  "controlled-test-data-history",
  "acceptance-overview",
  "acceptance-handoff",
  "deployment-verification",
  "acceptance-board",
];

const guards: [string, string][] = [
  ["src/lib/lead-acceptance-deep-links.ts", "LEAD_ACCEPTANCE_DEEP_LINKS_VERSION"],
  ["src/lib/lead-acceptance-deep-links.ts", "leadAcceptanceDeepLinks"],
  ["src/lib/lead-acceptance-deep-links.ts", "getLeadAcceptanceDeepLinks"],
  ["src/lib/lead-acceptance-deep-links.ts", "Read-only Lead acceptance deep-links catalog only"],
  ["src/app/admin/leads/deep-links/page.tsx", "leadAcceptanceDeepLinks"],
  ["src/app/admin/leads/deep-links/page.tsx", "/api/admin/leads/deep-links"],
  ["src/app/api/admin/leads/deep-links/route.ts", "NextResponse.json"],
  ["src/app/api/admin/leads/deep-links/route.ts", "requireRole(ADMIN_ROLES)"],
  ["src/app/api/admin/leads/deep-links/route.ts", "getLeadAcceptanceDeepLinks"],
  ["src/app/api/admin/leads/deep-links/route.ts", "Cache-Control"],
  ["src/app/admin/leads/deployment-verification/page.tsx", "Deep links API guard passed."],
  ["scripts/check-deployment-verification-guard.ts", "Deep links API guard passed."],
  ["package.json", "check-deep-links-api-guard.ts"],
  ...deepLinkSlugs.map((slug): [string, string] => ["src/lib/lead-acceptance-deep-links.ts", slug]),
];

for (const [path, expected] of guards) {
  assertContains(path, expected);
}

console.log("Deep links API guard passed.");
