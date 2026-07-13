import { readFileSync } from "node:fs";

function assertContains(path: string, expected: string) {
  const content = readFileSync(path, "utf8");
  if (!content.includes(expected)) {
    throw new Error(`${path} is missing required production smoke contract: ${expected}`);
  }
}

function assertExcludes(path: string, forbidden: string) {
  const content = readFileSync(path, "utf8");
  if (content.includes(forbidden)) {
    throw new Error(`${path} must remain non-mutating and minimally exposed; forbidden content: ${forbidden}`);
  }
}

const guards: [string, string][] = [
  [".github/workflows/production-smoke.yml", "name: Production Smoke"],
  [".github/workflows/production-smoke.yml", "push:"],
  [".github/workflows/production-smoke.yml", "branches: [main]"],
  [".github/workflows/production-smoke.yml", "workflow_dispatch:"],
  [".github/workflows/production-smoke.yml", "schedule:"],
  [".github/workflows/production-smoke.yml", 'cron: "17 */6 * * *"'],
  [".github/workflows/production-smoke.yml", "contents: read"],
  [".github/workflows/production-smoke.yml", "github.ref == 'refs/heads/main'"],
  [".github/workflows/production-smoke.yml", "EXPECTED_COMMIT_SHA: ${{ github.sha }}"],
  [".github/workflows/production-smoke.yml", "https://crm.mercurycalldesk.com"],
  [".github/workflows/production-smoke.yml", "npm run smoke:production"],
  ["src/app/api/status/route.ts", 'service: "crm-mcd"'],
  ["src/app/api/status/route.ts", "VERCEL_ENV"],
  ["src/app/api/status/route.ts", "VERCEL_GIT_COMMIT_REF"],
  ["src/app/api/status/route.ts", "VERCEL_GIT_COMMIT_SHA"],
  ["src/app/api/status/route.ts", "routeJsonResponse"],
  ["src/app/api/status/route.ts", "{ noindex: true }"],
  ["src/lib/route-json-response.ts", '"Cache-Control": "no-store, max-age=0"'],
  ["src/lib/route-json-response.ts", 'headers["X-Robots-Tag"] = "noindex, nofollow, noarchive"'],
  ["scripts/run-production-smoke.ts", "/api/status"],
  ["scripts/run-production-smoke.ts", 'payload.environment === "production"'],
  ["scripts/run-production-smoke.ts", 'payload.git?.branch === "main"'],
  ["scripts/run-production-smoke.ts", "expectedCommitSha"],
  ["scripts/run-production-smoke.ts", 'response.headers.get("cache-control")?.includes("no-store")'],
  ["scripts/run-production-smoke.ts", 'response.headers.get("x-robots-tag") === "noindex, nofollow, noarchive"'],
  ["scripts/run-production-smoke.ts", '!("commitMessage" in payload.git)'],
  ["scripts/run-production-smoke.ts", '!("deployment" in payload)'],
  ["scripts/run-production-smoke.ts", '!("timestamp" in payload)'],
  ["scripts/run-production-smoke.ts", "/admin/project-readiness"],
  ["scripts/run-production-smoke.ts", "/api/admin/project-readiness"],
  ["scripts/run-production-smoke.ts", "/admin/servicing/acceptance-command-center"],
  ["scripts/run-production-smoke.ts", "/api/admin/servicing/acceptance-readiness"],
  ["scripts/run-production-smoke.ts", 'matchedPath === "/login"'],
  ["scripts/run-production-smoke.ts", "GITHUB_STEP_SUMMARY"],
  ["scripts/run-production-smoke.ts", "Unauthenticated request resolves to /login"],
  ["docs/PRODUCTION_SMOKE.md", "Production Smoke"],
  ["docs/PRODUCTION_SMOKE.md", "minimal public deployment identity"],
  ["docs/PRODUCTION_SMOKE.md", "does not authenticate"],
  ["docs/PRODUCTION_SMOKE.md", "does not mutate"],
  ["docs/INDEX.md", "PRODUCTION_SMOKE.md"],
  ["src/lib/lead-deployment-verification.ts", "Production smoke automation guard passed."],
  ["scripts/check-deployment-verification-guard.ts", "Production smoke automation guard passed."],
  ["package.json", '"smoke:production": "tsx scripts/run-production-smoke.ts"'],
  ["package.json", '"check:production-smoke-guard": "tsx scripts/check-production-smoke-guard.ts"'],
  ["package.json", "check-production-smoke-guard.ts"],
];

for (const [path, expected] of guards) assertContains(path, expected);

for (const forbidden of [
  'method: "POST"',
  'method: "PUT"',
  'method: "PATCH"',
  'method: "DELETE"',
  "$executeRaw",
  "$queryRaw",
  "DATABASE_URL",
  "AUTH_SECRET",
  "NEXTAUTH_SECRET",
  "password=",
  "cookie:",
  "authorization:",
]) {
  assertExcludes("scripts/run-production-smoke.ts", forbidden);
}

for (const forbidden of ["VERCEL_GIT_COMMIT_MESSAGE", "VERCEL_URL", "VERCEL_REGION", "new Date().toISOString()", "NextResponse"] ) {
  assertExcludes("src/app/api/status/route.ts", forbidden);
}

for (const forbidden of ["pull_request_target:", "permissions: write-all", "contents: write", "id-token: write"]) {
  assertExcludes(".github/workflows/production-smoke.yml", forbidden);
}

console.log("Production smoke automation guard passed.");
