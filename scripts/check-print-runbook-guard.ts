import { readFileSync } from "node:fs";

function assertContains(path: string, expected: string) {
  const content = readFileSync(path, "utf8");
  if (!content.includes(expected)) {
    throw new Error(`${path} is missing required print runbook guard: ${expected}`);
  }
}

const guards: [string, string][] = [
  ["src/app/admin/leads/acceptance-runbook/print/page.tsx", "data-acceptance-runbook-print=\"lead-flow\""],
  ["src/app/admin/leads/acceptance-runbook/print/page.tsx", "Lead acceptance runbook — print view"],
  ["src/app/admin/leads/acceptance-runbook/print/page.tsx", "Print-friendly read-only operator reference"],
  ["src/app/admin/leads/acceptance-runbook/print/page.tsx", "acceptanceRunbookHref(step.id)"],
  ["src/app/admin/leads/acceptance-runbook/print/page.tsx", "leadProductionAcceptanceGroups"],
  ["src/lib/lead-acceptance-overview.ts", "print-runbook"],
  ["src/lib/lead-acceptance-overview.ts", "/admin/leads/acceptance-runbook/print"],
];

for (const [path, expected] of guards) {
  assertContains(path, expected);
}

console.log("Print runbook guard passed.");
