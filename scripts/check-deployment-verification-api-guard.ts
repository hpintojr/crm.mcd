import { readFileSync } from "node:fs";

function assertContains(path: string, expected: string) {
  const content = readFileSync(path, "utf8");
  if (!content.includes(expected)) {
    throw new Error(`${path} is missing required deployment verification API guard: ${expected}`);
  }
}

const guards: [string, string][] = [
  ["src/lib/lead-deployment-verification.ts", "LEAD_DEPLOYMENT_VERIFICATION_VERSION"],
  ["src/lib/lead-deployment-verification.ts", "EXPECTED_LEAD_FLOW_GUARD_LINES"],
  ["src/lib/lead-deployment-verification.ts", "getLeadDeploymentVerificationSnapshot"],
  ["src/lib/lead-deployment-verification.ts", "Read-only Lead deployment verification snapshot only"],
  ["src/app/admin/leads/deployment-verification/page.tsx", "getLeadDeploymentVerificationSnapshot"],
  ["src/app/admin/leads/deployment-verification/page.tsx", "/api/admin/leads/deployment-verification"],
  ["src/app/api/admin/leads/deployment-verification/route.ts", "authenticatedRequestId(request)"],
  ["src/app/api/admin/leads/deployment-verification/route.ts", "authenticatedJson"],
  ["src/app/api/admin/leads/deployment-verification/route.ts", "requireRole(ADMIN_ROLES)"],
  ["src/app/api/admin/leads/deployment-verification/route.ts", "getLeadDeploymentVerificationSnapshot"],
  ["src/app/api/admin/leads/deployment-verification/route.ts", "viewedBy: { role: actor.role }"],
  ["src/lib/lead-deployment-verification.ts", "Deployment verification API guard passed."],
  ["scripts/check-deployment-verification-guard.ts", "Deployment verification API guard passed."],
  ["package.json", "check-deployment-verification-api-guard.ts"],
];

for (const [path, expected] of guards) {
  assertContains(path, expected);
}

const route = readFileSync("src/app/api/admin/leads/deployment-verification/route.ts", "utf8");
for (const forbidden of ["NextResponse.json", "viewedBy: { id:", "actor.id", "actor.email", "request.json()", "request.text()"]) {
  if (route.includes(forbidden)) {
    throw new Error(`Deployment verification API contains forbidden response or identity behavior: ${forbidden}`);
  }
}

console.log("Deployment verification API guard passed.");
