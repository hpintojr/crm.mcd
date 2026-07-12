import { readFileSync } from "node:fs";

function assertContains(path: string, expected: string) {
  const content = readFileSync(path, "utf8");
  if (!content.includes(expected)) {
    throw new Error(`${path} is missing required acceptance summary CSV guard: ${expected}`);
  }
}

const guards: [string, string][] = [
  ["src/app/admin/leads/acceptance-summary.csv/route.ts", "getLeadAcceptanceOverview"],
  ["src/app/admin/leads/acceptance-summary.csv/route.ts", "requireRole(ADMIN_ROLES)"],
  ["src/app/admin/leads/acceptance-summary.csv/route.ts", "Read-only acceptance overview CSV export only"],
  ["src/app/admin/leads/acceptance-summary.csv/route.ts", "flattenCsv"],
  ["src/app/admin/leads/acceptance-summary.csv/route.ts", "mcd-lead-acceptance-summary"],
  ["src/app/admin/leads/acceptance-summary.csv/route.ts", "authenticatedRequestId(request)"],
  ["src/app/admin/leads/acceptance-summary.csv/route.ts", "authenticatedCsvDownload"],
  ["src/app/admin/leads/acceptance-summary.csv/route.ts", "viewedBy: { role: actor.role }"],
  ["src/lib/authenticated-json-boundary.ts", '"Content-Type": "text/csv; charset=utf-8"'],
  ["src/app/admin/leads/acceptance-overview/page.tsx", "/admin/leads/acceptance-summary.csv"],
  ["src/app/admin/leads/acceptance-overview/page.tsx", "CSV summary"],
  ["src/lib/lead-acceptance-overview.ts", "acceptance-summary-csv"],
  ["src/lib/lead-acceptance-overview.ts", "/admin/leads/acceptance-summary.csv"],
];

for (const [path, expected] of guards) {
  assertContains(path, expected);
}

const route = readFileSync("src/app/admin/leads/acceptance-summary.csv/route.ts", "utf8");
for (const forbidden of ["NextResponse", "viewedBy: { id:", "actor.id", "actor.email", "request.json()", "request.text()"] ) {
  if (route.includes(forbidden)) throw new Error(`Acceptance summary CSV route contains forbidden behavior: ${forbidden}`);
}

console.log("Acceptance summary CSV guard passed.");
