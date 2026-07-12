import { readFileSync } from "node:fs";

function assertContains(path: string, expected: string) {
  const content = readFileSync(path, "utf8");
  if (!content.includes(expected)) {
    throw new Error(`${path} is missing required project readiness contract: ${expected}`);
  }
}

function assertExcludes(path: string, forbidden: string) {
  const content = readFileSync(path, "utf8");
  if (content.includes(forbidden)) {
    throw new Error(`${path} must remain read-only and must not contain: ${forbidden}`);
  }
}

const guards: [string, string][] = [
  ["src/lib/project-readiness.ts", "PROJECT_READINESS_VERSION"],
  ["src/lib/project-readiness.ts", "CLIENT_SERVICE_SCHEMA_TABLES"],
  ["src/lib/project-readiness.ts", "COMMISSION_SCHEMA_TABLES"],
  ["src/lib/project-readiness.ts", "COMMISSION_SCHEMA_ENUMS"],
  ["src/lib/project-readiness.ts", "LEGACY_COMMISSION_TYPES"],
  ["src/lib/project-readiness.ts", "LEGACY_COMMISSION_LEDGER_COLUMNS"],
  ["src/lib/project-readiness.ts", "information_schema.tables"],
  ["src/lib/project-readiness.ts", "pg_enum"],
  ["src/lib/project-readiness.ts", "STAGED_ONLY"],
  ["src/lib/project-readiness.ts", "PARTIAL_OR_DRIFTED"],
  ["src/lib/project-readiness.ts", "getProjectReadinessSnapshot"],
  ["src/lib/project-readiness.ts", "does not apply migrations"],
  ["src/app/admin/project-readiness/page.tsx", "data-project-readiness=\"mcd-control-plane\""],
  ["src/app/admin/project-readiness/page.tsx", "Project readiness control plane"],
  ["src/app/admin/project-readiness/page.tsx", "getProjectReadinessSnapshot"],
  ["src/app/admin/project-readiness/page.tsx", "requireRole(ADMIN_ROLES)"],
  ["src/app/admin/project-readiness/page.tsx", "/api/admin/project-readiness"],
  ["src/app/admin/project-readiness/page.tsx", "Commission enum contract"],
  ["src/app/api/admin/project-readiness/route.ts", "export async function GET()"],
  ["src/app/api/admin/project-readiness/route.ts", "requireRole(ADMIN_ROLES)"],
  ["src/app/api/admin/project-readiness/route.ts", "getProjectReadinessSnapshot"],
  ["src/app/api/admin/project-readiness/route.ts", "Cache-Control"],
  ["src/app/admin/command-center/page.tsx", "/admin/project-readiness"],
  ["src/app/admin/operating-status/page.tsx", "/admin/project-readiness"],
  ["src/app/admin/settings/page.tsx", "/admin/project-readiness"],
  ["src/lib/lead-deployment-verification.ts", "Appointment Closed Won guard passed."],
  ["src/lib/lead-deployment-verification.ts", "Commission schema migration guard passed."],
  ["src/lib/lead-deployment-verification.ts", "Project readiness guard passed."],
  ["scripts/check-deployment-verification-guard.ts", "Project readiness guard passed."],
  ["README.md", "/admin/project-readiness"],
  ["docs/WORKSPACE.md", "/admin/project-readiness"],
  ["package.json", "check-project-readiness-guard.ts"],
];

for (const [path, expected] of guards) {
  assertContains(path, expected);
}

for (const path of [
  "src/lib/project-readiness.ts",
  "src/app/admin/project-readiness/page.tsx",
  "src/app/api/admin/project-readiness/route.ts",
]) {
  assertExcludes(path, "$executeRaw");
  assertExcludes(path, "$queryRawUnsafe");
  assertExcludes(path, "revalidatePath");
  assertExcludes(path, '"use server"');
}

console.log("Project readiness guard passed.");
