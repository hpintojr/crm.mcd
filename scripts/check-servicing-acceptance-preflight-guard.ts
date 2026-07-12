import { readFileSync } from "node:fs";

function assertContains(path: string, expected: string) {
  const content = readFileSync(path, "utf8");
  if (!content.includes(expected)) {
    throw new Error(`${path} is missing required Servicing acceptance preflight contract: ${expected}`);
  }
}

function assertExcludes(path: string, forbidden: string) {
  const content = readFileSync(path, "utf8");
  if (content.includes(forbidden)) {
    throw new Error(`${path} must remain read-only and must not contain: ${forbidden}`);
  }
}

const guards: [string, string][] = [
  ["src/lib/servicing-acceptance-readiness.ts", "SERVICING_ACCEPTANCE_READINESS_VERSION"],
  ["src/lib/servicing-acceptance-readiness.ts", "SERVICING_SCHEMA_TABLES"],
  ["src/lib/servicing-acceptance-readiness.ts", "SERVICING_ACCEPTANCE_STEPS"],
  ["src/lib/servicing-acceptance-readiness.ts", "OWNER_AUTHORIZATION_REQUIRED"],
  ["src/lib/servicing-acceptance-readiness.ts", "CONTROLLED_WINDOW_OPEN"],
  ["src/lib/servicing-acceptance-readiness.ts", "UNSAFE_GATE_COMBINATION"],
  ["src/lib/servicing-acceptance-readiness.ts", "information_schema.tables"],
  ["src/lib/servicing-acceptance-readiness.ts", "onboardingCandidates"],
  ["src/lib/servicing-acceptance-readiness.ts", "healthyCurrentAccounts"],
  ["src/lib/servicing-acceptance-readiness.ts", "Read-only Servicing acceptance preflight"],
  ["src/app/admin/servicing/acceptance-command-center/page.tsx", "data-servicing-acceptance-command-center=\"read-only\""],
  ["src/app/admin/servicing/acceptance-command-center/page.tsx", "Servicing acceptance command center"],
  ["src/app/admin/servicing/acceptance-command-center/page.tsx", "requireRole(ADMIN_ROLES)"],
  ["src/app/admin/servicing/acceptance-command-center/page.tsx", "getServicingAcceptanceReadinessSnapshot"],
  ["src/app/admin/servicing/acceptance-command-center/page.tsx", "/api/admin/servicing/acceptance-readiness"],
  ["src/app/admin/servicing/acceptance-command-center/page.tsx", "Owner authorization boundary"],
  ["src/app/admin/servicing/acceptance-command-center/page.tsx", "Counts only. No client or Lead identities"],
  ["src/app/api/admin/servicing/acceptance-readiness/route.ts", "export async function GET(request: NextRequest)"],
  ["src/app/api/admin/servicing/acceptance-readiness/route.ts", "authenticatedRequestId(request)"],
  ["src/app/api/admin/servicing/acceptance-readiness/route.ts", "authenticatedJson"],
  ["src/app/api/admin/servicing/acceptance-readiness/route.ts", "requireRole(ADMIN_ROLES)"],
  ["src/app/api/admin/servicing/acceptance-readiness/route.ts", "getServicingAcceptanceReadinessSnapshot"],
  ["src/app/api/admin/servicing/acceptance-readiness/route.ts", "snapshot.ok ? 200 : 503"],
  ["src/app/api/admin/servicing/acceptance-readiness/route.ts", "viewedBy: { role: actor.role }"],
  ["src/app/admin/servicing/testing/page.tsx", "/admin/servicing/acceptance-command-center"],
  ["src/app/admin/servicing/testing/page.tsx", "SERVICING_ACCEPTANCE_STEPS"],
  ["src/app/admin/servicing/testing/page.tsx", "id={step.id}"],
  ["src/app/admin/servicing/testing/page.tsx", "scroll-mt-6"],
  ["src/app/admin/operating-status/page.tsx", "/admin/servicing/acceptance-command-center"],
  ["src/app/admin/operating-status/page.tsx", "read-only Servicing command center"],
  ["src/lib/lead-deployment-verification.ts", "Servicing acceptance preflight guard passed."],
  ["scripts/check-deployment-verification-guard.ts", "Servicing acceptance preflight guard passed."],
  ["package.json", "check-servicing-acceptance-preflight-guard.ts"],
];

for (const [path, expected] of guards) {
  assertContains(path, expected);
}

for (const path of [
  "src/lib/servicing-acceptance-readiness.ts",
  "src/app/admin/servicing/acceptance-command-center/page.tsx",
  "src/app/api/admin/servicing/acceptance-readiness/route.ts",
]) {
  assertExcludes(path, "$executeRaw");
  assertExcludes(path, "$queryRawUnsafe");
  assertExcludes(path, "revalidatePath");
  assertExcludes(path, '"use server"');
  assertExcludes(path, "db.auditLog.create");
  assertExcludes(path, "createClientAccount");
  assertExcludes(path, "openClientServiceCase");
  assertExcludes(path, "confirmClientLaunch");
}

for (const forbidden of ["NextResponse.json", "viewedBy: { id:", "actor.id", "actor.email", "request.json()", "request.text()"]) {
  assertExcludes("src/app/api/admin/servicing/acceptance-readiness/route.ts", forbidden);
}

console.log("Servicing acceptance preflight guard passed.");
