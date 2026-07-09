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
assertContains("src/lib/lead-workspace.ts", "ACTIVITY_ONLY_NO_SOFT_LOCK");
assertContains("src/lib/lead-workspace.ts", "reservesLead: false");
assertContains("src/components/cold-lead-dial-button.tsx", "Click to call logs activity first");
assertContains("src/components/cold-lead-dial-button.tsx", "Dialer was not opened because activity must be logged first");
assertContains("src/app/api/portal/leads/call-start/route.ts", "ACTIVITY_ONLY_NO_SOFT_LOCK");
assertContains("src/app/portal/leads/page.tsx", "Cold Lead workspace");
assertContains("src/app/portal/leads/page.tsx", "Agent-friendly mode");
assertContains("src/app/portal/leads/page.tsx", "Business rules are unchanged");
assertContains("src/app/portal/workspace/page.tsx", "My Workspace");
assertContains("src/app/portal/workspace/page.tsx", "Claim timer");

assertContains("src/app/admin/leads/page.tsx", "/admin/leads/acceptance-command-center");
assertContains("src/app/admin/leads/page.tsx", "Lead command center");
assertContains("src/app/admin/leads/page.tsx", "Lead review");
assertContains("src/lib/lead-production-acceptance.ts", "LEAD_PRODUCTION_ACCEPTANCE_ACTION");
assertContains("src/lib/lead-production-acceptance.ts", "leadProductionAcceptanceGroups");
assertContains("src/lib/lead-production-acceptance.ts", "leadProductionAcceptanceSteps");
assertContains("src/lib/lead-production-acceptance.ts", "Verify click-to-call logs activity first");
assertContains("src/lib/lead-production-acceptance.ts", "Verify no-answer and voicemail stay unowned");
assertContains("src/lib/lead-production-acceptance.ts", "Use the controlled GHL event harness only");
assertContains("src/app/admin/leads/testing/page.tsx", "Production Lead Flow acceptance");
assertContains("src/app/admin/leads/testing/page.tsx", "/admin/leads/acceptance-command-center");
assertContains("src/app/admin/leads/testing/page.tsx", "Command center");
assertContains("src/app/admin/leads/testing/page.tsx", "revalidatePath(\"/admin/leads/acceptance-command-center\")");
assertContains("src/app/admin/leads/testing/page.tsx", "revalidatePath(\"/admin/leads/acceptance-report\")");
assertContains("src/app/admin/leads/acceptance-report/page.tsx", "Lead Production Acceptance Report");
assertContains("src/app/admin/leads/acceptance-report/page.tsx", "/admin/leads/acceptance-command-center");
assertContains("src/app/admin/leads/acceptance-report/page.tsx", "Command center");
assertContains("src/app/admin/leads/acceptance-report/page.tsx", "Owner decision readiness");
assertContains("src/app/admin/leads/acceptance-report/page.tsx", "Controlled acceptance evidence");
assertContains("src/app/api/admin/leads/acceptance-report/route.ts", "readyForOwnerDecision");
assertContains("src/app/api/admin/leads/acceptance-report/route.ts", "controlledEvidence");
assertContains("src/app/api/admin/leads/acceptance-report.csv/route.ts", "controlledEvidenceIncluded: true");
assertContains("src/lib/acceptance-evidence-summary.ts", "getAcceptanceEvidenceSummary");
assertContains("src/lib/acceptance-evidence-summary.ts", "liveGhlWorkflowActivated: false");

assertContains("src/app/admin/leads/acceptance-command-center/page.tsx", "Lead acceptance command center");
assertContains("src/app/admin/leads/acceptance-command-center/page.tsx", "data-acceptance-command-center=\"lead-flow\"");
assertContains("src/app/admin/leads/acceptance-command-center/page.tsx", "Next safe action");
assertContains("src/app/admin/leads/acceptance-command-center/page.tsx", "Gates that remain closed");
assertContains("src/app/admin/leads/acceptance-command-center/page.tsx", "This command center is intentionally non-mutating");
assertContains("src/app/admin/readiness/page.tsx", "commandHref: \"/admin/leads/acceptance-command-center\"");
assertContains("src/app/admin/readiness/page.tsx", "Lead command center");
assertContains("src/app/admin/readiness/page.tsx", "Command center");
assertContains("src/app/admin/operating-status/page.tsx", "Lead command center");
assertContains("src/app/admin/operating-status/page.tsx", "Use the command center as the starting point");
assertContains("src/app/admin/operating-status/page.tsx", "Command center");

assertContains("src/app/admin/audit/page.tsx", "NextCRM-inspired timeline view");
assertContains("src/app/admin/audit/page.tsx", "data-audit-ux=\"filter-bar\"");
assertContains("src/app/admin/audit/page.tsx", "Filtered audit timeline");
assertContains("src/app/admin/audit/page.tsx", "metadataPreview");
assertContains("src/app/admin/audit/page.tsx", "/admin/leads/acceptance-command-center");
assertContains("src/app/admin/audit/page.tsx", "Lead command center");
assertContains("src/app/admin/leads/controlled-test-data/page.tsx", "/admin/leads/acceptance-command-center");
assertContains("src/app/admin/leads/controlled-test-data/page.tsx", "Command center");
assertContains("src/app/admin/leads/controlled-test-data/page.tsx", "revalidatePath(\"/admin/leads/acceptance-command-center\")");
assertContains("src/app/admin/integrations/test-events/page.tsx", "/admin/leads/acceptance-command-center");
assertContains("src/app/admin/integrations/test-events/page.tsx", "Command center");
assertContains("src/app/admin/integrations/test-events/page.tsx", "revalidatePath(\"/admin/leads/acceptance-command-center\")");
assertContains("src/app/admin/integrations/page.tsx", "/admin/leads/acceptance-command-center");
assertContains("src/app/admin/integrations/page.tsx", "Lead command center");
assertContains("src/app/admin/integrations/page.tsx", "Open command center");
assertContains("src/app/admin/leads/replies/page.tsx", "Warm reply triage");
assertContains("src/app/admin/leads/replies/page.tsx", "starts the 45-day responsibility timer");
assertContains("src/lib/lead-appointment-attribution.ts", "GHL_APPOINTMENT_IGNORED");
assertContains("src/lib/lead-opportunity-attribution.ts", "GHL_OPPORTUNITY_LOST_PRESERVED");
assertContains("src/lib/lead-aging-jobs.ts", "dryRun?: boolean");
assertContains("src/lib/lead-aging-jobs.ts", "wouldReturnToOpenPool");
assertContains("src/app/api/admin/leads/aging-preview/route.ts", "mutationPerformed: false");
assertContains("src/app/api/cron/leads/aging/route.ts", "CRON_SECRET");
assertContains("src/lib/controlled-test-leads.ts", "CONTROLLED_TEST_GHL_EXPORT_BLOCK");
assertContains("src/app/admin/leads/controlled-test-data/page.tsx", "GHL export blocked by default");
assertContains("src/app/api/admin/leads/controlled-test-data/route.ts", "ghlExportBlockedByDefault: true");
assertContains("src/lib/controlled-ghl-test-events.ts", "The GHL test harness only accepts controlled test Leads");
assertContains("src/lib/controlled-ghl-test-events.ts", "liveGhlWorkflowActivated: false");
assertContains("src/app/admin/integrations/test-events/page.tsx", "Controlled GHL event harness");
assertContains("src/app/api/admin/integrations/test-events/route.ts", "applyControlledGhlTestEvent");

console.log("Lead flow alignment guard passed.");
