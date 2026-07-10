export type LeadAcceptanceFindingStatus = "CATALOGED" | "GUARDED" | "OPEN_GATE";

export type LeadAcceptanceFinding = {
  id: string;
  title: string;
  status: LeadAcceptanceFindingStatus;
  detail: string;
  evidence: string;
  href: string;
};

export const LEAD_ACCEPTANCE_FINDINGS_CATALOG_VERSION = "2026-07-10-pr68";
export const LEAD_ACCEPTANCE_FINDINGS_LATEST_PRODUCTION_COMMIT = "6c24a25bf425e10d1e5529af0835f4fc6e968543";

export const leadAcceptanceFindings: LeadAcceptanceFinding[] = [
  {
    id: "runbook-section-anchor-contract",
    title: "Runbook sections have stable hash anchors",
    status: "GUARDED",
    detail:
      "PR #66 added stable id attributes to every Lead acceptance runbook section so operators can link directly to a test instruction without relying on browser text matching.",
    evidence:
      "Guarded by scripts/check-lead-flow-alignment.ts via id={step.id} on /admin/leads/acceptance-runbook.",
    href: "/admin/leads/acceptance-runbook",
  },
  {
    id: "eighteen-steps-eleven-sections",
    title: "18 acceptance evidence steps map to 11 runbook sections",
    status: "CATALOGED",
    detail:
      "The acceptance board records 18 evidence steps, while the runbook contains 11 broader operating sections. Direct /acceptance-runbook#${step.id} links would miss several sections.",
    evidence:
      "PR #67 added src/lib/acceptance-runbook-links.ts to explicitly map every evidence-step id to a valid runbook section id.",
    href: "/admin/leads/acceptance-runbook",
  },
  {
    id: "acceptance-history-read-only",
    title: "Acceptance history is read-only and newest-first",
    status: "GUARDED",
    detail:
      "The history page shows the 200 most recent immutable LEAD_PRODUCTION_ACCEPTANCE_RECORDED audit records without mutating Leads, feature flags, GHL workflows, or business rules.",
    evidence:
      "Guarded by the page marker data-acceptance-history=\"lead-flow\" and sourceLimit: 200 in the CSV export guard.",
    href: "/admin/leads/acceptance-history",
  },
  {
    id: "history-export-audit-record",
    title: "History CSV export writes only an immutable export audit record",
    status: "GUARDED",
    detail:
      "The history CSV endpoint follows the existing acceptance-report CSV pattern by reading acceptance records and writing only a LEAD_PRODUCTION_ACCEPTANCE_HISTORY_EXPORT_CREATED audit event.",
    evidence:
      "No Lead mutation, import/export submission, feature flag update, or external GHL call is performed by the CSV endpoint.",
    href: "/api/admin/leads/acceptance-history.csv",
  },
  {
    id: "owner-acceptance-remains-hamilton-only",
    title: "Authenticated production acceptance remains Hamilton-only",
    status: "OPEN_GATE",
    detail:
      "The tooling can guide and record the acceptance run, but the authenticated production acceptance decisions and owner production decision remain Hamilton-only.",
    evidence:
      "No automated acceptance evidence was recorded by ChatGPT in PR #66, PR #67, or this catalog slice.",
    href: "/admin/leads/testing",
  },
  {
    id: "closed-operations-gates-remain-closed",
    title: "Operational expansion gates remain closed",
    status: "OPEN_GATE",
    detail:
      "Live GHL workflow activation, additional live imports/exports, Servicing, Commissions, Finance, payout, and client-onboarding activation remain outside this acceptance-tooling scope.",
    evidence:
      "The command center, runbook, findings catalog, history, report, and exports are read-only guidance or audit surfaces only.",
    href: "/admin/leads/acceptance-command-center",
  },
];

export function leadAcceptanceFindingCounts() {
  return {
    cataloged: leadAcceptanceFindings.filter((finding) => finding.status === "CATALOGED").length,
    guarded: leadAcceptanceFindings.filter((finding) => finding.status === "GUARDED").length,
    openGates: leadAcceptanceFindings.filter((finding) => finding.status === "OPEN_GATE").length,
    total: leadAcceptanceFindings.length,
  };
}
