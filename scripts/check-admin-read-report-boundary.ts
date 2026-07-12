import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function read(path: string) {
  return readFileSync(path, "utf8");
}

function assertContains(path: string, expected: string) {
  assert(read(path).includes(expected), `${path} is missing protected Admin report contract: ${expected}`);
}

function checkSharedReports() {
  const reports = [
    "src/app/api/admin/leads/deployment-verification/route.ts",
    "src/app/api/admin/project-readiness/route.ts",
    "src/app/api/admin/servicing/acceptance-readiness/route.ts",
  ];

  for (const path of reports) {
    const content = read(path);
    for (const expected of [
      'export const dynamic = "force-dynamic"',
      "authenticatedRequestId(request)",
      "requireRole(ADMIN_ROLES)",
      "authenticatedJson",
      "viewedBy: { role: actor.role }",
    ]) {
      assert(content.includes(expected), `${path} is missing hardened report behavior: ${expected}`);
    }

    for (const forbidden of [
      "NextResponse.json",
      "viewedBy: { id:",
      "actor.id",
      "actor.email",
      "request.json()",
      "request.text()",
      '"use server"',
    ]) {
      assert(!content.includes(forbidden), `${path} contains forbidden report behavior: ${forbidden}`);
    }
  }

  assertContains("src/app/api/admin/leads/deployment-verification/route.ts", "getLeadDeploymentVerificationSnapshot()");
  assertContains("src/app/api/admin/project-readiness/route.ts", "getProjectReadinessSnapshot()");
  assertContains("src/app/api/admin/servicing/acceptance-readiness/route.ts", "getServicingAcceptanceReadinessSnapshot()");
  assertContains("src/app/api/admin/servicing/acceptance-readiness/route.ts", "snapshot.ok ? 200 : 503");
}

function checkControlledTestReport() {
  const path = "src/app/api/admin/leads/controlled-test-data/route.ts";
  const content = read(path);
  for (const expected of [
    'export const dynamic = "force-dynamic"',
    "authenticatedRequestId(request)",
    "requireRole(ADMIN_ROLES)",
    "authenticatedJson",
    "controlledTestLeadWhere",
    "take: 100",
    "generatedByRole: actor.role",
    "controlledTestSource: CONTROLLED_TEST_LEAD_SOURCE",
    "controlledTestCampaign: CONTROLLED_TEST_LEAD_CAMPAIGN",
    "controlledTestCampaignExternalId: CONTROLLED_TEST_GHL_EXPORT_BLOCK",
    "usesSyntheticContactData: true",
    "doesNotActivateGhlWorkflows: true",
    "hasAnyGhlIdentifier",
  ]) {
    assert(content.includes(expected), `${path} is missing controlled-test report behavior: ${expected}`);
  }

  for (const forbidden of [
    "NextResponse.json",
    "actor.id",
    "actor.email",
    "request.json()",
    "request.text()",
    ".create(",
    ".update(",
    ".updateMany(",
    ".delete(",
    ".deleteMany(",
    ".upsert(",
    ".$transaction",
    '"use server"',
  ]) {
    assert(!content.includes(forbidden), `${path} contains forbidden controlled-test report mutation or response behavior: ${forbidden}`);
  }
}

function checkRepositoryContract() {
  for (const [path, expected] of [
    ["docs/ADMIN_READ_REPORT_BOUNDARY.md", "Covered reports"],
    ["docs/ADMIN_READ_REPORT_BOUNDARY.md", "does not query production during validation"],
    ["docs/INDEX.md", "ADMIN_READ_REPORT_BOUNDARY.md"],
    ["package.json", '"check:admin-read-report-boundary": "tsx scripts/check-admin-read-report-boundary.ts"'],
    ["package.json", "check-admin-read-report-boundary.ts"],
    ["src/lib/lead-deployment-verification.ts", "Admin read report response boundary guard passed."],
    ["scripts/check-deployment-verification-guard.ts", "Admin read report response boundary guard passed."],
  ] as const) {
    assertContains(path, expected);
  }
}

function main() {
  checkSharedReports();
  checkControlledTestReport();
  checkRepositoryContract();
  console.log("Admin read report response boundary guard passed.");
}

main();
