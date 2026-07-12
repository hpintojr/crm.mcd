import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertContains(path: string, expected: string) {
  const content = readFileSync(path, "utf8");
  assert(content.includes(expected), `${path} is missing route trace contract: ${expected}`);
}

const helperPath = "src/lib/route-trace.ts";
const tracedFiles = [
  "src/lib/authz.ts",
  "src/app/admin/page.tsx",
  "src/app/portal/layout.tsx",
];

for (const expected of [
  'import "server-only";',
  'process.env.ROUTE_TRACE_ENABLED?.trim().toLowerCase() === "true"',
  'console.info("[route-trace]", event, metadata)',
  'console.info("[route-trace]", event)',
]) {
  assertContains(helperPath, expected);
}

for (const path of tracedFiles) {
  const content = readFileSync(path, "utf8");
  assertContains(path, 'import { routeTrace } from "@/lib/route-trace";');
  assert(!content.includes('console.info("[route-trace]'), `${path} must not emit unconditional route traces.`);
}

assertContains("src/lib/authz.ts", 'routeTrace("requireUser: auth start")');
assertContains("src/lib/authz.ts", 'routeTrace("requireUser: auth finished", { hasUserId: Boolean(userId) })');
assertContains("src/lib/authz.ts", 'routeTrace("requireRole: evaluated", { allowed: roles.includes(user.role) })');
assertContains("src/app/admin/page.tsx", 'routeTrace("admin page entered")');
assertContains("src/app/portal/layout.tsx", 'routeTrace("portal layout entered")');
assertContains(".env.example", 'ROUTE_TRACE_ENABLED="false"');
assertContains("docs/ROUTE_TRACING.md", "Route tracing is disabled by default");
assertContains("docs/ROUTE_TRACING.md", "Do not include credentials, tokens, Lead identities, client identities, or financial data");

console.log("Route trace hygiene guard passed.");
