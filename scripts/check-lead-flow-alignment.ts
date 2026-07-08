import { readFileSync } from "node:fs";

function assertContains(path: string, expected: string) {
  const content = readFileSync(path, "utf8");
  if (!content.includes(expected)) {
    throw new Error(`${path} is missing required lead-flow guard: ${expected}`);
  }
}

assertContains("src/lib/claims.ts", "twoWayContactAt: { not: null }");
assertContains("src/lib/claims.ts", "openPoolReleaseAt: releaseAt");
assertContains("src/lib/claims.ts", "TWO_WAY_CONTACT_REQUIRED");
assertContains("src/lib/lead-workspace.ts", "logColdLeadCallInitiated");
assertContains("src/lib/lead-workspace.ts", "logColdLeadDisposition");
assertContains("src/lib/lead-workspace.ts", "ACTIVITY_ONLY_NO_SOFT_LOCK");
assertContains("src/lib/lead-workspace.ts", "reservesLead: false");
assertContains("src/app/portal/leads/page.tsx", "Cold Lead workspace");
assertContains("src/app/portal/leads/page.tsx", "selectedCold");
assertContains("src/app/portal/workspace/page.tsx", "My Workspace");
assertContains("src/app/portal/workspace/page.tsx", "Work Cold Leads");
assertContains("src/app/portal/workspace/page.tsx", "Claim timer");
assertContains("src/lib/lead-aging-jobs.ts", "LEAD_AUTO_RETURNED_TO_OPEN_POOL");
assertContains("src/lib/lead-aging-jobs.ts", "LEAD_PROMOTED_TO_SHARK_TANK");
assertContains("src/app/api/cron/leads/aging/route.ts", "CRON_SECRET");
assertContains("src/app/api/cron/leads/aging/route.ts", "runLeadAgingSweep");

console.log("Lead flow alignment guard passed.");
