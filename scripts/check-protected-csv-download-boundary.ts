import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function read(path: string) {
  return readFileSync(path, "utf8");
}

function assertContains(path: string, expected: string) {
  assert(read(path).includes(expected), `${path} is missing protected CSV download contract: ${expected}`);
}

function checkSharedHelper() {
  const path = "src/lib/authenticated-json-boundary.ts";
  const content = read(path);
  for (const expected of [
    "authenticatedCsvDownload",
    '"Content-Type": "text/csv; charset=utf-8"',
    '"Content-Disposition": `attachment; filename="${filename}"`',
    '"Cache-Control": "no-store, max-age=0"',
    '"X-Request-Id": requestId',
    '"X-Robots-Tag": "noindex, nofollow, noarchive"',
  ]) {
    assert(content.includes(expected), `${path} is missing CSV helper behavior: ${expected}`);
  }
}

function checkRoutes() {
  const routes = [
    "src/app/api/admin/leads/acceptance-history.csv/route.ts",
    "src/app/api/admin/leads/acceptance-report.csv/route.ts",
    "src/app/admin/leads/acceptance-summary.csv/route.ts",
    "src/app/api/admin/audit/export/route.ts",
  ];

  for (const path of routes) {
    const content = read(path);
    for (const expected of [
      'export const dynamic = "force-dynamic"',
      "authenticatedRequestId(request)",
      "authenticatedCsvDownload",
      "requireRole(",
    ]) {
      assert(content.includes(expected), `${path} is missing protected download behavior: ${expected}`);
    }
    for (const forbidden of ["NextResponse", "request.json()", "request.text()"] ) {
      assert(!content.includes(forbidden), `${path} contains forbidden direct response or body behavior: ${forbidden}`);
    }
  }
}

function checkAcceptanceHistoryContract() {
  const path = "src/app/api/admin/leads/acceptance-history.csv/route.ts";
  for (const expected of [
    '"reviewer_user_id"',
    "take: 200",
    'actionType: "LEAD_PRODUCTION_ACCEPTANCE_HISTORY_EXPORT_CREATED"',
    'entityType: "LeadProductionAcceptanceHistory"',
    "sourceLimit: 200",
    "mcd-lead-acceptance-history-",
  ]) assertContains(path, expected);
}

function checkAcceptanceReportContract() {
  const path = "src/app/api/admin/leads/acceptance-report.csv/route.ts";
  for (const expected of [
    "take: 1_000",
    'actionType: "LEAD_PRODUCTION_ACCEPTANCE_EXPORT_CREATED"',
    'entityType: "LeadProductionAcceptanceReport"',
    "controlledEvidenceIncluded: true",
    "mcd-lead-production-acceptance-",
    '"recorded_by_role"',
  ]) assertContains(path, expected);
}

function checkAcceptanceSummaryContract() {
  const path = "src/app/admin/leads/acceptance-summary.csv/route.ts";
  for (const expected of [
    "getLeadAcceptanceOverview()",
    "flattenCsv",
    'viewedBy: { role: actor.role }',
    '[["path", "type", "value"], ...rows]',
    "mcd-lead-acceptance-summary-",
  ]) assertContains(path, expected);
  const content = read(path);
  for (const forbidden of ["viewedBy: { id:", "actor.id", "actor.email", "db.", '"use server"']) {
    assert(!content.includes(forbidden), `${path} contains forbidden identity or mutation behavior: ${forbidden}`);
  }
}

function checkAuditExportContract() {
  const path = "src/app/api/admin/audit/export/route.ts";
  for (const expected of [
    'const ADMIN_ROLES = ["OWNER", "SUPER_ADMIN", "COMPLIANCE_MANAGER", "FINANCE_MANAGER"]',
    "take: 10_000",
    '"actor_user_id"',
    '"ip_address"',
    '"metadata"',
    'actionType: "AUDIT_EXPORT_CREATED"',
    'entityType: "AuditLog"',
    "mcd-audit-",
  ]) assertContains(path, expected);
}

function checkRepositoryContract() {
  for (const [path, expected] of [
    ["docs/PROTECTED_CSV_DOWNLOAD_BOUNDARY.md", "Covered downloads"],
    ["docs/PROTECTED_CSV_DOWNLOAD_BOUNDARY.md", "does not invoke an export"],
    ["docs/INDEX.md", "PROTECTED_CSV_DOWNLOAD_BOUNDARY.md"],
    ["package.json", '"check:protected-csv-download-boundary": "tsx scripts/check-protected-csv-download-boundary.ts"'],
    ["package.json", "check-protected-csv-download-boundary.ts"],
    ["src/lib/lead-deployment-verification.ts", "Protected CSV download response boundary guard passed."],
    ["scripts/check-deployment-verification-guard.ts", "Protected CSV download response boundary guard passed."],
  ] as const) assertContains(path, expected);
}

function main() {
  checkSharedHelper();
  checkRoutes();
  checkAcceptanceHistoryContract();
  checkAcceptanceReportContract();
  checkAcceptanceSummaryContract();
  checkAuditExportContract();
  checkRepositoryContract();
  console.log("Protected CSV download response boundary guard passed.");
}

main();
