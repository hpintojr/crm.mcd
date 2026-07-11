import { readFileSync } from "node:fs";

function assertContains(path: string, expected: string) {
  const content = readFileSync(path, "utf8");
  if (!content.includes(expected)) {
    throw new Error(`${path} is missing required deferred acceptance runbook guard: ${expected}`);
  }
}

const guards: [string, string][] = [
  ["src/app/admin/leads/acceptance-runbook/deferred/page.tsx", "data-acceptance-deferred-runbook=\"lead-flow\""],
  ["src/app/admin/leads/acceptance-runbook/deferred/page.tsx", "Deferred acceptance runbook"],
  ["src/app/admin/leads/acceptance-runbook/deferred/page.tsx", "Read-only view of the five deferred production-acceptance steps"],
  ["src/app/admin/leads/acceptance-runbook/deferred/page.tsx", "Deferred-step boundary"],
  ["src/app/admin/leads/acceptance-runbook/deferred/page.tsx", "getLeadAcceptanceDeferredRunbook"],
  ["src/app/admin/leads/acceptance-runbook/deferred/page.tsx", "data-deferred-acceptance-step={step.id}"],
  ["src/app/admin/leads/acceptance-runbook/deferred/page.tsx", "scroll-mt-6"],
  ["src/lib/lead-acceptance-deferred.ts", "LEAD_ACCEPTANCE_DEFERRED_VERSION"],
  ["src/lib/lead-acceptance-deferred.ts", "DEFERRED_ACCEPTANCE_STEP_IDS"],
  ["src/lib/lead-acceptance-deferred.ts", "getLeadAcceptanceDeferredRunbook"],
  ["src/lib/lead-acceptance-overview.ts", "deferred-steps"],
  ["src/lib/lead-acceptance-overview.ts", "/admin/leads/acceptance-runbook/deferred"],
];

for (const [path, expected] of guards) {
  assertContains(path, expected);
}

console.log("Deferred acceptance runbook guard passed.");
