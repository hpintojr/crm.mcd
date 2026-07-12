import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function read(path: string) {
  return readFileSync(path, "utf8");
}

function assertContains(path: string, expected: string) {
  assert(read(path).includes(expected), `${path} is missing legacy import retirement contract: ${expected}`);
}

function checkRetiredRoute() {
  const path = "src/app/api/admin/leads/route.ts";
  const content = read(path);

  for (const expected of [
    'export const dynamic = "force-dynamic"',
    "authenticatedRequestId(request)",
    "requireRole(ADMIN_ROLES)",
    "authenticatedJson",
    "This legacy Lead import endpoint is retired.",
    'preview: "/api/admin/leads/import/preview"',
    'commit: "/api/admin/leads/import"',
    "410",
  ]) {
    assert(content.includes(expected), `${path} is missing retired-route behavior: ${expected}`);
  }

  const authIndex = content.indexOf("requireRole(ADMIN_ROLES)");
  const retiredIndex = content.indexOf("This legacy Lead import endpoint is retired.");
  assert(authIndex >= 0 && retiredIndex > authIndex, "The legacy route must authenticate before disclosing replacement endpoints.");

  for (const forbidden of [
    "request.json()",
    "request.text()",
    "prepareAuthenticatedJson",
    "db.",
    "previewLeadImport",
    "lead.create",
    "leadSuppression",
    "auditLog",
    "leadActivity",
    "createdIds",
    "createdCount",
    "NextResponse",
    "z.object",
  ]) {
    assert(!content.includes(forbidden), `${path} must not retain legacy import behavior: ${forbidden}`);
  }
}

function checkSupportedClientPath() {
  const path = "src/components/admin-lead-import-form.tsx";
  const content = read(path);
  for (const expected of [
    'mode === "preview" ? "/api/admin/leads/import/preview" : "/api/admin/leads/import"',
    "Commit reviewed batch",
    "previewed",
  ]) {
    assert(content.includes(expected), `${path} must continue using the supported import lifecycle: ${expected}`);
  }
  assert(!content.includes('fetch("/api/admin/leads"'), "The Admin import UI must not call the retired endpoint.");
}

function checkRepositoryContract() {
  for (const [path, expected] of [
    ["docs/LEGACY_ADMIN_LEAD_IMPORT_RETIREMENT.md", "Why the route was retired"],
    ["docs/LEGACY_ADMIN_LEAD_IMPORT_RETIREMENT.md", "HTTP 410"],
    ["docs/LEGACY_ADMIN_LEAD_IMPORT_RETIREMENT.md", "does not call the retired endpoint"],
    ["docs/INDEX.md", "LEGACY_ADMIN_LEAD_IMPORT_RETIREMENT.md"],
    ["package.json", '"check:legacy-admin-lead-import-retirement": "tsx scripts/check-legacy-admin-lead-import-retirement.ts"'],
    ["package.json", "check-legacy-admin-lead-import-retirement.ts"],
    ["src/lib/lead-deployment-verification.ts", "Legacy Admin Lead import retirement guard passed."],
    ["scripts/check-deployment-verification-guard.ts", "Legacy Admin Lead import retirement guard passed."],
  ] as const) {
    assertContains(path, expected);
  }
}

function main() {
  checkRetiredRoute();
  checkSupportedClientPath();
  checkRepositoryContract();
  console.log("Legacy Admin Lead import retirement guard passed.");
}

main();
