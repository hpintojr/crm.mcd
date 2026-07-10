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

assertContains("src/app/admin/command-center/page.tsx", "/admin/leads/acceptance-command-center");
assertContains("src/app/admin/command-center/page.tsx", "Lead command center");
assertContains("src/app/admin/command-center/page.tsx", "production acceptance entrypoints");
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

assertContains("src/app/admin/leads/acceptance-runbook/page.tsx", "Lead acceptance runbook");
assertContains("src/app/admin/leads/acceptance-runbook/page.tsx", "data-acceptance-runbook=\"lead-flow\"");
assertContains("src/app/admin/leads/acceptance-runbook/page.tsx", "Gates that remain closed");
assertContains("src/app/admin/leads/acceptance-runbook/page.tsx", "Verify the two-way-contact claim gate");
assertContains("src/app/admin/leads/acceptance-runbook/page.tsx", "Verify the Warm Reply Triage 45-day timer");
assertContains("src/app/admin/leads/acceptance-runbook/page.tsx", "Verify DNC suppresses and cancels callbacks");
assertContains("src/app/admin/leads/acceptance-runbook/page.tsx", "Only use the controlled GHL event harness");
assertContains("src/app/admin/leads/acceptance-runbook/page.tsx", "mutationPerformed:false");
assertContains("src/app/admin/leads/acceptance-runbook/page.tsx", "id={step.id}");
assertContains("src/app/admin/leads/acceptance-command-center/page.tsx", "/admin/leads/acceptance-runbook");
assertContains("src/app/admin/leads/acceptance-command-center/page.tsx", "Acceptance runbook");

assertContains("src/app/admin/command-center/page.tsx", "/admin/leads/acceptance-runbook");
assertContains("src/app/admin/command-center/page.tsx", "Lead acceptance runbook");
assertContains("src/app/admin/readiness/page.tsx", "/admin/leads/acceptance-runbook");
assertContains("src/app/admin/readiness/page.tsx", "Lead acceptance runbook");
assertContains("src/app/admin/readiness/page.tsx", "Acceptance runbook");
assertContains("src/app/admin/readiness/page.tsx", "runbookHref: \"/admin/leads/acceptance-runbook\"");

assertContains("src/app/admin/leads/testing/page.tsx", "/admin/leads/acceptance-runbook");
assertContains("src/app/admin/leads/testing/page.tsx", "Acceptance runbook");

assertContains("src/app/admin/leads/acceptance-runbook/checklist/page.tsx", "Lead acceptance runbook — printable checklist");
assertContains("src/app/admin/leads/acceptance-runbook/checklist/page.tsx", "data-acceptance-runbook-checklist=\"lead-flow\"");
assertContains("src/app/admin/leads/acceptance-runbook/checklist/page.tsx", "Gates that remain closed");
assertContains("src/app/admin/leads/acceptance-runbook/checklist/page.tsx", "Sign-off");
assertContains("src/app/admin/leads/acceptance-runbook/page.tsx", "/admin/leads/acceptance-runbook/checklist");
assertContains("src/app/admin/leads/acceptance-runbook/page.tsx", "Printable checklist");

assertContains("src/app/admin/operating-status/page.tsx", "/admin/leads/acceptance-runbook");
assertContains("src/app/admin/operating-status/page.tsx", "Lead acceptance runbook");
assertContains("src/app/admin/audit/page.tsx", "/admin/leads/acceptance-runbook");
assertContains("src/app/admin/audit/page.tsx", "Lead acceptance runbook");
assertContains("src/app/admin/leads/page.tsx", "/admin/leads/acceptance-runbook");
assertContains("src/app/admin/leads/page.tsx", "Lead acceptance runbook");

assertContains("src/app/admin/leads/acceptance-report/page.tsx", "/admin/leads/acceptance-runbook");
assertContains("src/app/admin/leads/acceptance-report/page.tsx", "Acceptance runbook");
assertContains("src/app/admin/leads/controlled-test-data/page.tsx", "/admin/leads/acceptance-runbook");
assertContains("src/app/admin/leads/controlled-test-data/page.tsx", "Acceptance runbook");
assertContains("src/app/admin/integrations/test-events/page.tsx", "/admin/leads/acceptance-runbook");
assertContains("src/app/admin/integrations/test-events/page.tsx", "Acceptance runbook");
assertContains("src/app/admin/integrations/page.tsx", "/admin/leads/acceptance-runbook");
assertContains("src/app/admin/integrations/page.tsx", "Lead acceptance runbook");

assertContains("src/app/admin/leads/acceptance-runbook/page.tsx", "Where to record each step");
assertContains("src/app/admin/leads/acceptance-runbook/page.tsx", "data-acceptance-runbook-matrix=\"lead-flow\"");
assertContains("src/app/admin/leads/acceptance-runbook/page.tsx", "LEAD_PRODUCTION_ACCEPTANCE_RECORDED");
assertContains("src/app/admin/leads/acceptance-runbook/page.tsx", "Perform on");
assertContains("src/app/admin/leads/acceptance-runbook/page.tsx", "Record on");

assertContains("src/lib/acceptance-runbook-links.ts", "ACCEPTANCE_RUNBOOK_SECTION_BY_STEP");
assertContains("src/lib/acceptance-runbook-links.ts", "\"click-to-call-logs-first\": \"click-to-call\"");
assertContains("src/lib/acceptance-runbook-links.ts", "acceptanceRunbookHref");
assertContains("src/app/admin/leads/acceptance-command-center/page.tsx", "How to test this step");
assertContains("src/app/admin/leads/acceptance-command-center/page.tsx", "/admin/leads/acceptance-history");
assertContains("src/app/admin/leads/acceptance-report/page.tsx", "Acceptance history");
assertContains("src/app/admin/leads/acceptance-report/page.tsx", "acceptanceRunbookHref(step.id)");
assertContains("src/app/admin/leads/acceptance-report/page.tsx", "Runbook");
assertContains("src/app/admin/leads/testing/page.tsx", "Runbook step");
assertContains("src/app/admin/leads/testing/page.tsx", "id={step.id}");
assertContains("src/app/admin/leads/testing/page.tsx", "revalidatePath(\"/admin/leads/acceptance-history\")");
assertContains("src/app/admin/leads/acceptance-history/page.tsx", "data-acceptance-history=\"lead-flow\"");
assertContains("src/app/admin/leads/acceptance-history/page.tsx", "200 most recent immutable Lead production acceptance records");
assertContains("src/app/admin/leads/acceptance-history/page.tsx", "/api/admin/leads/acceptance-history.csv");
assertContains("src/app/admin/leads/acceptance-history/page.tsx", "acceptanceRunbookHref(stepId)");
assertContains("src/app/api/admin/leads/acceptance-history.csv/route.ts", "LEAD_PRODUCTION_ACCEPTANCE_HISTORY_EXPORT_CREATED");
assertContains("src/app/api/admin/leads/acceptance-history.csv/route.ts", "sourceLimit: 200");
assertContains("src/app/api/admin/leads/acceptance-history.csv/route.ts", "acceptanceRunbookHref(stepId)");

assertContains("src/lib/lead-acceptance-findings.ts", "LEAD_ACCEPTANCE_FINDINGS_CATALOG_VERSION");
assertContains("src/lib/lead-acceptance-findings.ts", "eighteen-steps-eleven-sections");
assertContains("src/lib/lead-acceptance-findings.ts", "owner-acceptance-remains-hamilton-only");
assertContains("src/app/admin/leads/acceptance-findings/page.tsx", "data-acceptance-findings=\"lead-flow\"");
assertContains("src/app/admin/leads/acceptance-findings/page.tsx", "Lead acceptance findings catalog");
assertContains("src/app/admin/leads/acceptance-findings/page.tsx", "Findings session");
assertContains("src/app/api/admin/leads/acceptance-findings/route.ts", "leadAcceptanceFindings");
assertContains("src/app/api/admin/leads/acceptance-findings/route.ts", "Read-only findings catalog only");
assertContains("src/app/admin/leads/acceptance-command-center/page.tsx", "/admin/leads/acceptance-findings");
assertContains("src/app/admin/leads/acceptance-command-center/page.tsx", "Findings catalog");
assertContains("src/app/admin/leads/acceptance-report/page.tsx", "/admin/leads/acceptance-findings");
assertContains("src/app/admin/leads/acceptance-history/page.tsx", "/admin/leads/acceptance-findings");

assertContains("src/lib/lead-acceptance-handoff.ts", "LEAD_ACCEPTANCE_HANDOFF_PACKET_VERSION");
assertContains("src/lib/lead-acceptance-handoff.ts", "getLeadAcceptanceHandoffPacket");
assertContains("src/lib/lead-acceptance-handoff.ts", "leadAcceptanceClosedGates");
assertContains("src/app/admin/leads/acceptance-handoff/page.tsx", "data-acceptance-handoff=\"lead-flow\"");
assertContains("src/app/admin/leads/acceptance-handoff/page.tsx", "Lead acceptance handoff packet");
assertContains("src/app/admin/leads/acceptance-handoff/page.tsx", "Handoff recommendation");
assertContains("src/app/api/admin/leads/acceptance-handoff/route.ts", "getLeadAcceptanceHandoffPacket");
assertContains("src/app/api/admin/leads/acceptance-handoff/route.ts", "Read-only acceptance handoff packet only");
assertContains("src/app/admin/leads/acceptance-findings/page.tsx", "/admin/leads/acceptance-handoff");

assertContains("src/lib/lead-acceptance-gaps.ts", "LEAD_ACCEPTANCE_GAPS_VERSION");
assertContains("src/lib/lead-acceptance-gaps.ts", "getLeadAcceptanceEvidenceGaps");
assertContains("src/lib/lead-acceptance-gaps.ts", "recordHref");
assertContains("src/app/admin/leads/acceptance-gaps/page.tsx", "data-acceptance-gaps=\"lead-flow\"");
assertContains("src/app/admin/leads/acceptance-gaps/page.tsx", "Lead acceptance evidence gaps");
assertContains("src/app/admin/leads/acceptance-gaps/page.tsx", "Next evidence gap");
assertContains("src/app/api/admin/leads/acceptance-gaps/route.ts", "getLeadAcceptanceEvidenceGaps");
assertContains("src/app/api/admin/leads/acceptance-gaps/route.ts", "Read-only acceptance evidence gaps only");
assertContains("src/app/admin/leads/acceptance-handoff/page.tsx", "/admin/leads/acceptance-gaps");
assertContains("src/app/admin/leads/acceptance-handoff/page.tsx", "View evidence gaps");

assertContains("src/lib/lead-acceptance-matrix.ts", "LEAD_ACCEPTANCE_MATRIX_VERSION");
assertContains("src/lib/lead-acceptance-matrix.ts", "getLeadAcceptanceEvidenceMatrix");
assertContains("src/lib/lead-acceptance-matrix.ts", "recordHref");
assertContains("src/app/admin/leads/acceptance-matrix/page.tsx", "data-acceptance-matrix=\"lead-flow\"");
assertContains("src/app/admin/leads/acceptance-matrix/page.tsx", "Lead acceptance evidence matrix");
assertContains("src/app/admin/leads/acceptance-matrix/page.tsx", "All acceptance evidence rows");
assertContains("src/app/api/admin/leads/acceptance-matrix/route.ts", "getLeadAcceptanceEvidenceMatrix");
assertContains("src/app/api/admin/leads/acceptance-matrix/route.ts", "Read-only acceptance evidence matrix only");
assertContains("src/app/admin/leads/acceptance-handoff/page.tsx", "/admin/leads/acceptance-matrix");
assertContains("src/app/admin/leads/acceptance-handoff/page.tsx", "View evidence matrix");
assertContains("src/app/admin/leads/acceptance-gaps/page.tsx", "/admin/leads/acceptance-matrix");

assertContains("src/lib/lead-acceptance-gates.ts", "LEAD_ACCEPTANCE_GATES_VERSION");
assertContains("src/lib/lead-acceptance-gates.ts", "getLeadAcceptanceClosedGates");
assertContains("src/lib/lead-acceptance-gates.ts", "leadAcceptanceClosedGates");
assertContains("src/app/admin/leads/acceptance-gates/page.tsx", "data-acceptance-gates=\"lead-flow\"");
assertContains("src/app/admin/leads/acceptance-gates/page.tsx", "Lead acceptance closed gates");
assertContains("src/app/admin/leads/acceptance-gates/page.tsx", "Closed-gates recommendation");
assertContains("src/app/api/admin/leads/acceptance-gates/route.ts", "getLeadAcceptanceClosedGates");
assertContains("src/app/api/admin/leads/acceptance-gates/route.ts", "Read-only closed acceptance gates only");
assertContains("src/app/admin/leads/acceptance-handoff/page.tsx", "/admin/leads/acceptance-gates");
assertContains("src/app/admin/leads/acceptance-handoff/page.tsx", "View closed gates");
assertContains("src/app/admin/leads/acceptance-gaps/page.tsx", "/admin/leads/acceptance-gates");
assertContains("src/app/admin/leads/acceptance-matrix/page.tsx", "/admin/leads/acceptance-gates");

assertContains("src/lib/lead-acceptance-overview.ts", "LEAD_ACCEPTANCE_OVERVIEW_VERSION");
assertContains("src/lib/lead-acceptance-overview.ts", "getLeadAcceptanceOverview");
assertContains("src/lib/lead-acceptance-overview.ts", "leadAcceptanceOverviewEntries");
assertContains("src/app/admin/leads/acceptance-overview/page.tsx", "data-acceptance-overview=\"lead-flow\"");
assertContains("src/app/admin/leads/acceptance-overview/page.tsx", "Lead acceptance overview");
assertContains("src/app/admin/leads/acceptance-overview/page.tsx", "Overview recommendation");
assertContains("src/app/api/admin/leads/acceptance-overview/route.ts", "getLeadAcceptanceOverview");
assertContains("src/app/api/admin/leads/acceptance-overview/route.ts", "Read-only Lead acceptance overview only");
assertContains("src/app/admin/leads/acceptance-handoff/page.tsx", "/admin/leads/acceptance-overview");
assertContains("src/app/admin/leads/acceptance-gaps/page.tsx", "/admin/leads/acceptance-overview");
assertContains("src/app/admin/leads/acceptance-matrix/page.tsx", "/admin/leads/acceptance-overview");
assertContains("src/app/admin/leads/acceptance-gates/page.tsx", "/admin/leads/acceptance-overview");
assertContains("src/app/admin/leads/acceptance-history/page.tsx", "/admin/leads/acceptance-overview");
assertContains("src/app/admin/leads/acceptance-findings/page.tsx", "/admin/leads/acceptance-overview");
assertContains("src/app/admin/leads/acceptance-command-center/page.tsx", "/admin/leads/acceptance-overview");
assertContains("src/app/admin/leads/acceptance-report/page.tsx", "/admin/leads/acceptance-overview");
assertContains("src/app/admin/leads/testing/page.tsx", "/admin/leads/acceptance-overview");
assertContains("src/app/admin/leads/acceptance-runbook/page.tsx", "/admin/leads/acceptance-overview");
assertContains("src/app/admin/leads/acceptance/page.tsx", "requireRole(ADMIN_ROLES)");
assertContains("src/app/admin/leads/acceptance/page.tsx", "redirect(\"/admin/leads/acceptance-overview\")");
assertContains("src/app/admin/leads/page.tsx", "/admin/leads/acceptance-overview");
assertContains("src/app/admin/leads/page.tsx", "Lead acceptance overview");

console.log("Lead flow alignment guard passed.");
