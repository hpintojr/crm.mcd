import { readFileSync } from "node:fs";

function assertContains(path: string, expected: string) {
  const content = readFileSync(path, "utf8");
  if (!content.includes(expected)) {
    throw new Error(`${path} is missing required overview deferred summary guard: ${expected}`);
  }
}

const guards: [string, string][] = [
  ["src/app/admin/leads/acceptance-overview/page.tsx", "data-acceptance-overview-deferred=\"lead-flow\""],
  ["src/app/admin/leads/acceptance-overview/page.tsx", "Deferred blockers"],
  ["src/app/admin/leads/acceptance-overview/page.tsx", "Read-only summary of the five deferred production-acceptance steps"],
  ["src/app/admin/leads/acceptance-overview/page.tsx", "data-acceptance-overview-deferred-row={step.id}"],
  ["src/app/admin/leads/acceptance-overview/page.tsx", "getLeadAcceptanceDeferredRunbook"],
  ["src/app/admin/leads/acceptance-overview/page.tsx", "/admin/leads/acceptance-runbook/deferred"],
  ["src/app/admin/leads/acceptance-overview/page.tsx", "Full deferred runbook"],
];

for (const [path, expected] of guards) {
  assertContains(path, expected);
}

console.log("Overview deferred summary guard passed.");
