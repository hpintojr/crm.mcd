const ACCEPTANCE_RUNBOOK_SECTION_BY_STEP: Record<string, string> = {
  "custom-domain-status-smoke": "open-command-center",
  "protected-route-boundaries": "open-command-center",
  "cron-auth-boundary": "aging-preview",
  "runtime-error-log-check": "open-command-center",
  "corrected-batch-state": "seed-controlled-data",
  "cold-lead-visibility": "click-to-call",
  "click-to-call-logs-first": "click-to-call",
  "click-to-call-blocks-on-error": "click-to-call",
  "no-answer-boundary": "no-answer-ownership",
  "two-way-contact-claim-gate": "two-way-contact-claim",
  "claim-responsibility-timer": "two-way-contact-claim",
  "dnc-blackout": "dnc-blackout",
  "my-workspace-dashboard": "two-way-contact-claim",
  "warm-reply-timer": "warm-reply-timer",
  "ghl-appointment-hardening": "ghl-controlled-events",
  "ghl-opportunity-hardening": "ghl-controlled-events",
  "aging-sweep-contract": "aging-preview",
  "owner-production-decision": "owner-decision",
};

export function acceptanceRunbookHref(stepId: string) {
  const sectionId = ACCEPTANCE_RUNBOOK_SECTION_BY_STEP[stepId] ?? "record-evidence";
  return `/admin/leads/acceptance-runbook#${sectionId}`;
}
