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

console.log("Lead flow alignment guard passed.");
