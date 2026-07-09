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
assertContains("src/app/portal/leads/page.tsx", "ColdLeadDialButton");
assertContains("src/components/cold-lead-dial-button.tsx", "Click to call logs activity first");
assertContains("src/components/cold-lead-dial-button.tsx", "/api/portal/leads/call-start");
assertContains("src/components/cold-lead-dial-button.tsx", "window.location.href = telHref(phone)");
assertContains("src/components/cold-lead-dial-button.tsx", "Dialer was not opened because activity must be logged first");
assertContains("src/app/api/portal/leads/call-start/route.ts", "logColdLeadCallInitiated");
assertContains("src/app/api/portal/leads/call-start/route.ts", "ACTIVITY_ONLY_NO_SOFT_LOCK");
assertContains("src/app/portal/workspace/page.tsx", "My Workspace");
assertContains("src/app/portal/workspace/page.tsx", "Work Cold Leads");
assertContains("src/app/portal/workspace/page.tsx", "Claim timer");
assertContains("src/app/admin/leads/testing/page.tsx", "Lead Flow Alignment acceptance test");
assertContains("src/app/admin/leads/testing/page.tsx", "PR_34_LEAD_FLOW_ALIGNMENT");
assertContains("src/app/admin/leads/testing/page.tsx", "Verify call start is activity only");
assertContains("src/app/admin/leads/testing/page.tsx", "Verify My Workspace dashboard");
assertContains("src/app/admin/leads/replies/page.tsx", "Warm reply triage");
assertContains("src/app/admin/leads/replies/page.tsx", "openPoolReleaseAt: releaseAt");
assertContains("src/app/admin/leads/replies/page.tsx", "Warm-reply assignment requires a recorded two-way contact");
assertContains("src/app/admin/leads/replies/page.tsx", "starts the 45-day responsibility timer");
assertContains("src/lib/lead-appointment-attribution.ts", "GHL_APPOINTMENT_IGNORED");
assertContains("src/lib/lead-appointment-attribution.ts", "Suppressed Lead was not changed by a GHL appointment event");
assertContains("src/lib/lead-appointment-attribution.ts", "callbackExpedited");
assertContains("src/lib/lead-appointment-attribution.ts", "twoWayContactRecorded");
assertContains("src/app/api/ghl/appointments/route.ts", "leadIgnored");
assertContains("src/lib/lead-opportunity-attribution.ts", "GHL_OPPORTUNITY_IGNORED");
assertContains("src/lib/lead-opportunity-attribution.ts", "callbacksCancelled");
assertContains("src/lib/lead-opportunity-attribution.ts", "GHL_OPPORTUNITY_LOST_PRESERVED");
assertContains("src/app/api/ghl/opportunities/route.ts", "preservedClosedWon");
assertContains("src/app/api/ghl/opportunities/route.ts", "callbacksCancelled");
assertContains("src/lib/lead-aging-jobs.ts", "LEAD_AUTO_RETURNED_TO_OPEN_POOL");
assertContains("src/lib/lead-aging-jobs.ts", "LEAD_PROMOTED_TO_SHARK_TANK");
assertContains("src/app/api/cron/leads/aging/route.ts", "CRON_SECRET");
assertContains("src/app/api/cron/leads/aging/route.ts", "runLeadAgingSweep");

console.log("Lead flow alignment guard passed.");
