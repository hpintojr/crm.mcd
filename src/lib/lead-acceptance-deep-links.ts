import "server-only";

export const LEAD_ACCEPTANCE_DEEP_LINKS_VERSION = "2026-07-11-pr93";

export type LeadAcceptanceDeepLinkPriority = "OWNER" | "REVIEW" | "REFERENCE" | "BOARD";

export type LeadAcceptanceDeepLinkEntry = {
  id: string;
  title: string;
  description: string;
  href: string;
  priority: LeadAcceptanceDeepLinkPriority;
};

export const leadAcceptanceDeepLinks: LeadAcceptanceDeepLinkEntry[] = [
  {
    id: "owner-decision-prep",
    title: "Owner decision prep",
    description: "Read-only Hamilton owner-decision prep. Non-owner blockers, deferred steps, closed gates, and the acceptance-board owner row.",
    href: "/admin/leads/owner-decision-prep",
    priority: "OWNER",
  },
  {
    id: "acceptance-diff",
    title: "Acceptance diff",
    description: "Read-only comparison between the required Lead Flow acceptance contract and the latest recorded production-acceptance evidence.",
    href: "/admin/leads/acceptance-diff",
    priority: "REVIEW",
  },
  {
    id: "deferred-runbook",
    title: "Deferred acceptance runbook",
    description: "Read-only view of the five deferred production-acceptance steps with runbook-section links and record anchors.",
    href: "/admin/leads/acceptance-runbook/deferred",
    priority: "REVIEW",
  },
  {
    id: "print-runbook",
    title: "Print acceptance runbook",
    description: "Compact print-friendly read-only operator reference for the 18 production-acceptance steps.",
    href: "/admin/leads/acceptance-runbook/print",
    priority: "REFERENCE",
  },
  {
    id: "controlled-test-data-history",
    title: "Controlled test data history",
    description: "Read-only history of controlled test Leads: lifecycle end state, scenario notes, and audit event counts.",
    href: "/admin/leads/controlled-test-data/history",
    priority: "REFERENCE",
  },
  {
    id: "acceptance-overview",
    title: "Acceptance overview",
    description: "Read-only landing page for Lead production acceptance. Start here for entrypoints, deferred blockers summary, and recommendations.",
    href: "/admin/leads/acceptance-overview",
    priority: "REVIEW",
  },
  {
    id: "acceptance-handoff",
    title: "Acceptance handoff packet",
    description: "Read-only acceptance handoff packet with evidence counts, findings, and closed gates.",
    href: "/admin/leads/acceptance-handoff",
    priority: "REVIEW",
  },
  {
    id: "deployment-verification",
    title: "Deployment verification",
    description: "Read-only Vercel deployment status snapshot with expected guard-pass lines.",
    href: "/admin/leads/deployment-verification",
    priority: "REFERENCE",
  },
  {
    id: "acceptance-board",
    title: "Acceptance board",
    description: "Hamilton-only place to record authenticated production acceptance evidence.",
    href: "/admin/leads/testing",
    priority: "BOARD",
  },
];

export function getLeadAcceptanceDeepLinks() {
  return {
    ok: true,
    version: LEAD_ACCEPTANCE_DEEP_LINKS_VERSION,
    count: leadAcceptanceDeepLinks.length,
    entries: leadAcceptanceDeepLinks,
    safetyBoundary:
      "Read-only Lead acceptance deep-links catalog only. Does not mutate Leads, audit records, feature flags, GHL workflows, imports, exports, commissions, payouts, finance, client onboarding, or business rules.",
  };
}
