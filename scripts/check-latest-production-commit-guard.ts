import { readFileSync } from "node:fs";

function assertContains(path: string, expected: string) {
  const content = readFileSync(path, "utf8");
  if (!content.includes(expected)) {
    throw new Error(`${path} is missing required latest-production-commit guard: ${expected}`);
  }
}

function assertNotContains(path: string, forbidden: string) {
  const content = readFileSync(path, "utf8");
  if (content.includes(forbidden)) {
    throw new Error(`${path} still contains the stale hardcoded latest-production-commit source: ${forbidden}`);
  }
}

const guards: [string, string][] = [
  ["src/lib/lead-acceptance-handoff.ts", "getLeadDeploymentVerificationSnapshot"],
  ["src/lib/lead-acceptance-handoff.ts", "latestProductionCommit: getLeadDeploymentVerificationSnapshot().commitSha,"],
  ["src/lib/lead-acceptance-handoff.ts", "@/lib/lead-deployment-verification"],
];

for (const [path, expected] of guards) {
  assertContains(path, expected);
}

// The Lead acceptance handoff packet must source its "latest production
// commit" from the live deployment-verification snapshot, not from the
// hardcoded findings-catalog marker constant. That constant remains a
// valid, intentionally-pinned baseline for the acceptance-diff page's
// "findings catalog production marker" drift check, but the handoff
// packet itself must not read it directly anymore.
assertNotContains(
  "src/lib/lead-acceptance-handoff.ts",
  "latestProductionCommit: LEAD_ACCEPTANCE_FINDINGS_LATEST_PRODUCTION_COMMIT,"
);

console.log("Latest production commit guard passed.");
