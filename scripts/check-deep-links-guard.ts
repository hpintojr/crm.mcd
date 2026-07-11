import { readFileSync } from "node:fs";

function assertContains(path: string, expected: string) {
  const content = readFileSync(path, "utf8");
  if (!content.includes(expected)) {
    throw new Error(`${path} is missing required deep-links guard: ${expected}`);
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
  ["src/app/admin/leads/deep-links/page.tsx", "data-deep-links=\"lead-flow\""],
  ["src/app/admin/leads/deep-links/page.tsx", "Acceptance deep links"],
  ["src/app/admin/leads/deep-links/page.tsx", "leadAcceptanceDeepLinks"],
  ["src/app/admin/leads/deep-links/page.tsx", "data-deep-links-section={entry.id}"],
  ["src/app/admin/leads/deep-links/page.tsx", "data-deep-links-index-pill={entry.id}"],
  ["src/app/admin/leads/deep-links/page.tsx", "id={entry.id}"],
  ["src/app/admin/leads/deep-links/page.tsx", "scroll-mt-6"],
  ["src/lib/lead-acceptance-deep-links.ts", "leadAcceptanceDeepLinks"],
  ...deepLinkSlugs.map((slug): [string, string] => ["src/lib/lead-acceptance-deep-links.ts", slug]),
  ["src/lib/lead-acceptance-overview.ts", "deep-links"],
  ["src/lib/lead-acceptance-overview.ts", "/admin/leads/deep-links"],
  ["src/app/admin/leads/acceptance-overview/page.tsx", "/admin/leads/deep-links"],
];

for (const [path, expected] of guards) {
  assertContains(path, expected);
}

console.log("Deep links guard passed.");
