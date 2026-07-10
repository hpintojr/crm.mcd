import { getLeadAcceptanceClosedGates } from "@/lib/lead-acceptance-gates";
import { getLeadAcceptanceHandoffPacket } from "@/lib/lead-acceptance-handoff";

export const LEAD_ACCEPTANCE_OVERVIEW_VERSION = "2026-07-10-pr81";

export type LeadAcceptanceOverviewEntry = {
  id: string;
  title: string;
  description: string;
  href: string;
  priority: "START" | "REVIEW" | "AUDIT" | "REFERENCE";
};

export const leadAcceptanceOverviewEntries: LeadAcceptanceOverviewEntry[] = [
  {
    id: "handoff-packet",
    title: "Handoff packet",
    description: "Start here for current evidence counts, latest acceptance records, findings, and closed gates.",
    href: "/admin/leads/acceptance-handoff",
    priority: "START",
  },
  {
    id: "evidence-matrix",
    title: "Evidence matrix",
    description: "Review all 18 acceptance steps in one read-only table with status, timestamps, notes, and links.",
    href: "/admin/leads/acceptance-matrix",
    priority: "REVIEW",
  },
  {
    id: "evidence-gaps",
    title: "Evidence gaps",
    description: "Focus only on missing, failed, or deferred acceptance evidence.",
    href: "/admin/leads/acceptance-gaps",
    priority: "REVIEW",
  },
  {
    id: "deferred-steps",
    title: "Deferred steps",
    description: "Resume the five deferred acceptance steps with operator notes and where-to-record pointers.",
    href: "/admin/leads/acceptance-runbook/deferred",
    priority: "REVIEW",
  },
  {
    id: "closed-gates",
    title: "Closed gates",
    description: "Confirm which operational gates remain closed unless Hamilton separately approves opening them.",
    href: "/admin/leads/acceptance-gates",
    priority: "REVIEW",
  },
  {
    id: "command-center",
    title: "Command center",
    description: "Use the original guided acceptance cockpit and next-safe-action flow.",
    href: "/admin/leads/acceptance-command-center",
    priority: "START",
  },
  {
    id: "acceptance-report",
    title: "Acceptance report",
    description: "Review the acceptance report, readiness summary, and controlled evidence sections.",
    href: "/admin/leads/acceptance-report",
    priority: "AUDIT",
  },
  {
    id: "acceptance-summary-csv",
    title: "Acceptance summary CSV",
    description: "Download a read-only CSV flattening of the acceptance overview JSON for stakeholder handoff.",
    href: "/admin/leads/acceptance-summary.csv",
    priority: "AUDIT",
  },
  {
    id: "acceptance-history",
    title: "Acceptance history",
    description: "Inspect the latest immutable production-acceptance audit records.",
    href: "/admin/leads/acceptance-history",
    priority: "AUDIT",
  },
  {
    id: "findings-catalog",
    title: "Findings catalog",
    description: "Review cataloged findings, guarded contracts, and open gates discovered during acceptance work.",
    href: "/admin/leads/acceptance-findings",
    priority: "REFERENCE",
  },
  {
    id: "acceptance-runbook",
    title: "Acceptance runbook",
    description: "Follow the operator runbook with mapped sections for each evidence step.",
    href: "/admin/leads/acceptance-runbook",
    priority: "REFERENCE",
  },
  {
    id: "printable-checklist",
    title: "Printable checklist",
    description: "Use the printable runbook checklist for offline review or sign-off prep.",
    href: "/admin/leads/acceptance-runbook/checklist",
    priority: "REFERENCE",
  },
  {
    id: "acceptance-board",
    title: "Acceptance board",
    description: "Hamilton-only place to record authenticated production acceptance evidence.",
    href: "/admin/leads/testing",
    priority: "START",
  },
];

export async function getLeadAcceptanceOverview() {
  const [packet, gates] = await Promise.all([getLeadAcceptanceHandoffPacket(), getLeadAcceptanceClosedGates()]);
  const openEvidence = packet.evidence.failed + packet.evidence.deferred + packet.evidence.missing;

  return {
    ok: true,
    version: LEAD_ACCEPTANCE_OVERVIEW_VERSION,
    phase: packet.phase,
    latestProductionCommit: packet.latestProductionCommit,
    statusBaselineCommit: packet.statusBaselineCommit,
    evidence: {
      totalSteps: packet.evidence.totalSteps,
      passed: packet.evidence.passed,
      failed: packet.evidence.failed,
      deferred: packet.evidence.deferred,
      missing: packet.evidence.missing,
      open: openEvidence,
      fullyPassed: packet.evidence.fullyPassed,
      readyForOwnerDecision: packet.evidence.readyForOwnerDecision,
      nextStep: packet.evidence.nextStep,
    },
    gates: {
      total: gates.counts.total,
      closed: gates.counts.closed,
      open: gates.counts.open,
    },
    findings: packet.findings.counts,
    entrypoints: leadAcceptanceOverviewEntries,
    recommendation: packet.evidence.fullyPassed
      ? "All acceptance evidence is pass-recorded. Keep operational gates closed unless Hamilton separately approves opening them."
      : packet.evidence.readyForOwnerDecision
        ? "All non-owner-decision evidence is pass-ready. Hamilton can record the owner production decision from the acceptance board."
        : packet.evidence.nextStep
          ? `Continue with: ${packet.evidence.nextStep.title}`
          : "No acceptance steps are configured.",
    safetyBoundary:
      "Read-only Lead acceptance overview only. Does not mutate Leads, audit records, feature flags, GHL workflows, imports, exports, commissions, payouts, finance, client onboarding, or business rules.",
  };
}
