import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function read(path: string) {
  return readFileSync(path, "utf8");
}

function assertContains(path: string, expected: string) {
  assert(read(path).includes(expected), `${path} is missing Lead acceptance report boundary: ${expected}`);
}

const REPORT_ROUTES = [
  "src/app/api/admin/leads/acceptance-findings/route.ts",
  "src/app/api/admin/leads/acceptance-gaps/route.ts",
  "src/app/api/admin/leads/acceptance-gates/route.ts",
  "src/app/api/admin/leads/acceptance-handoff/route.ts",
  "src/app/api/admin/leads/acceptance-matrix/route.ts",
  "src/app/api/admin/leads/acceptance-overview/route.ts",
  "src/app/api/admin/leads/acceptance-report/route.ts",
  "src/app/api/admin/leads/deep-links/route.ts",
  "src/app/api/admin/leads/aging-preview/route.ts",
] as const;

function checkSharedBoundary() {
  for (const path of REPORT_ROUTES) {
    const content = read(path);
    for (const expected of [
      'export const dynamic = "force-dynamic"',
      "authenticatedRequestId(request)",
      "requireRole(ADMIN_ROLES)",
      "authenticatedJson",
    ]) {
      assert(content.includes(expected), `${path} is missing shared protected report behavior: ${expected}`);
    }

    for (const forbidden of [
      "NextResponse.json",
      "viewedBy: { id:",
      "actor.id",
      "actor.email",
      "request.json()",
      "request.text()",
      '"use server"',
      ".create(",
      ".createMany(",
      ".update(",
      ".updateMany(",
      ".delete(",
      ".deleteMany(",
      ".upsert(",
      ".$transaction",
      "revalidatePath",
    ]) {
      assert(!content.includes(forbidden), `${path} contains forbidden response, identity, body, or mutation behavior: ${forbidden}`);
    }
  }
}

function checkReportContracts() {
  for (const [path, expected] of [
    ["src/app/api/admin/leads/acceptance-findings/route.ts", "leadAcceptanceFindingCounts()"],
    ["src/app/api/admin/leads/acceptance-findings/route.ts", "findings: leadAcceptanceFindings"],
    ["src/app/api/admin/leads/acceptance-gaps/route.ts", "getLeadAcceptanceEvidenceGaps()"],
    ["src/app/api/admin/leads/acceptance-gates/route.ts", "getLeadAcceptanceClosedGates()"],
    ["src/app/api/admin/leads/acceptance-handoff/route.ts", "getLeadAcceptanceHandoffPacket()"],
    ["src/app/api/admin/leads/acceptance-matrix/route.ts", "getLeadAcceptanceEvidenceMatrix()"],
    ["src/app/api/admin/leads/acceptance-overview/route.ts", "getLeadAcceptanceOverview()"],
    ["src/app/api/admin/leads/deep-links/route.ts", "getLeadAcceptanceDeepLinks()"],
    ["src/app/api/admin/leads/acceptance-report/route.ts", "getAcceptanceEvidenceSummary()"],
    ["src/app/api/admin/leads/acceptance-report/route.ts", "take: 1_000"],
    ["src/app/api/admin/leads/acceptance-report/route.ts", 'reportType: "lead-production-acceptance"'],
    ["src/app/api/admin/leads/acceptance-report/route.ts", "servicingCommissionsFinanceRemainGated: true"],
    ["src/app/api/admin/leads/aging-preview/route.ts", "runLeadAgingSweep({ dryRun: true"],
    ["src/app/api/admin/leads/aging-preview/route.ts", "mutationPerformed: false"],
    ["src/app/api/admin/leads/aging-preview/route.ts", "readLimit(request)"],
  ] as const) {
    assertContains(path, expected);
  }

  for (const path of [
    "src/app/api/admin/leads/acceptance-findings/route.ts",
    "src/app/api/admin/leads/acceptance-gaps/route.ts",
    "src/app/api/admin/leads/acceptance-gates/route.ts",
    "src/app/api/admin/leads/acceptance-handoff/route.ts",
    "src/app/api/admin/leads/acceptance-matrix/route.ts",
    "src/app/api/admin/leads/acceptance-overview/route.ts",
    "src/app/api/admin/leads/deep-links/route.ts",
  ]) {
    assertContains(path, "viewedBy: { role: actor.role }");
  }
  assertContains("src/app/api/admin/leads/acceptance-report/route.ts", "generatedByRole: actor.role");
  assertContains("src/app/api/admin/leads/aging-preview/route.ts", "generatedByRole: actor.role");
}

function checkDownloadSeparation() {
  const helper = read("src/lib/authenticated-json-boundary.ts");
  assert(helper.includes('"Content-Type": "text/csv; charset=utf-8"'), "CSV helper must retain its CSV content type.");
  assert(helper.includes('"Content-Disposition": `attachment; filename="${filename}"`'), "CSV helper must retain its download disposition.");

  for (const path of [
    "src/app/api/admin/leads/acceptance-history.csv/route.ts",
    "src/app/api/admin/leads/acceptance-report.csv/route.ts",
  ]) {
    const content = read(path);
    assert(content.includes("authenticatedCsvDownload"), `${path} must use the protected CSV download helper.`);
    assert(content.includes("authenticatedRequestId(request)"), `${path} must propagate a request ID.`);
    assert(!content.includes("authenticatedJson"), `${path} must remain separate from the JSON report boundary.`);
    assert(!content.includes("NextResponse"), `${path} must not construct download responses directly.`);
  }
}

function checkRepositoryContract() {
  for (const [path, expected] of [
    ["docs/LEAD_ACCEPTANCE_REPORT_BOUNDARY.md", "Covered JSON reports"],
    ["docs/LEAD_ACCEPTANCE_REPORT_BOUNDARY.md", "CSV and download separation"],
    ["docs/LEAD_ACCEPTANCE_REPORT_BOUNDARY.md", "does not query production during validation"],
    ["docs/INDEX.md", "LEAD_ACCEPTANCE_REPORT_BOUNDARY.md"],
    ["package.json", '"check:lead-acceptance-report-boundary": "tsx scripts/check-lead-acceptance-report-boundary.ts"'],
    ["package.json", "check-lead-acceptance-report-boundary.ts"],
    ["src/lib/lead-deployment-verification.ts", "Lead acceptance report response boundary guard passed."],
    ["scripts/check-deployment-verification-guard.ts", "Lead acceptance report response boundary guard passed."],
  ] as const) {
    assertContains(path, expected);
  }
}

function main() {
  checkSharedBoundary();
  checkReportContracts();
  checkDownloadSeparation();
  checkRepositoryContract();
  console.log("Lead acceptance report response boundary guard passed.");
}

main();
