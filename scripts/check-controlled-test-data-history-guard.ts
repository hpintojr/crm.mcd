import { readFileSync } from "node:fs";

function assertContains(path: string, expected: string) {
  const content = readFileSync(path, "utf8");
  if (!content.includes(expected)) {
    throw new Error(`${path} is missing required controlled test data history guard: ${expected}`);
  }
}

const guards: [string, string][] = [
  ["src/app/admin/leads/controlled-test-data/history/page.tsx", "data-controlled-test-data-history=\"lead-flow\""],
  ["src/app/admin/leads/controlled-test-data/history/page.tsx", "Controlled test data history"],
  ["src/app/admin/leads/controlled-test-data/history/page.tsx", "Read-only history of controlled test Leads"],
  ["src/app/admin/leads/controlled-test-data/history/page.tsx", "This page does not create, archive, claim, suppress, export, or mutate Leads"],
  ["src/app/admin/leads/controlled-test-data/history/page.tsx", "controlledTestLeadWhere"],
  ["src/app/admin/leads/controlled-test-data/history/page.tsx", "data-controlled-test-history-lead={lead.id}"],
  ["src/app/admin/leads/controlled-test-data/history/page.tsx", "GHL export blocked"],
  ["src/app/admin/leads/controlled-test-data/history/page.tsx", "Lifecycle history"],
  ["src/app/admin/leads/controlled-test-data/history/page.tsx", "/admin/leads/acceptance-overview"],
  ["src/app/admin/leads/controlled-test-data/history/page.tsx", "/admin/leads/acceptance-runbook/deferred"],
];

for (const [path, expected] of guards) {
  assertContains(path, expected);
}

console.log("Controlled test data history guard passed.");
