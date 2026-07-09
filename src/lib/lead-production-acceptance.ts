export const LEAD_PRODUCTION_ACCEPTANCE_ACTION = "LEAD_PRODUCTION_ACCEPTANCE_RECORDED";
export const LEAD_PRODUCTION_ACCEPTANCE_ENTITY = "LeadProductionAcceptanceStep";
export const LEAD_PRODUCTION_ACCEPTANCE_PHASE = "PRODUCTION_ACCEPTANCE_20260709";
export const LEAD_STATUS_BASELINE_COMMIT = "85241b306e9799983226450a6876e71e52665995";

export type LeadProductionAcceptanceOutcome = "PASS" | "FAIL" | "DEFERRED";

export type LeadProductionAcceptanceStep = {
  id: string;
  title: string;
  detail: string;
  evidence: string;
  href?: string;
  action?: string;
};

export type LeadProductionAcceptanceGroup = {
  title: string;
  detail: string;
  steps: LeadProductionAcceptanceStep[];
};

export const leadProductionAcceptanceGroups: LeadProductionAcceptanceGroup[] = [
  {
    title: "Release and domain readiness",
    detail: "Non-mutating production checks that prove the public hostname is on the deployment-status baseline or a newer main build and protected routes are healthy.",
    steps: [
      { id: "custom-domain-status-smoke", title: "1. Confirm custom-domain deployment status", detail: "Open /api/status on crm.mercurycalldesk.com and confirm production, branch main, and a commit at or newer than the deployment-status baseline. This proves the public hostname is not serving a stale pre-status deployment.", evidence: `Status baseline commit: ${LEAD_STATUS_BASELINE_COMMIT}. Record the current response timestamp and current commit SHA from /api/status.`, href: "/api/status", action: "Open status" },
      { id: "protected-route-boundaries", title: "2. Confirm protected route boundaries", detail: "Check /portal/workspace, /portal/leads, and /admin/leads/testing from the custom domain. Unauthenticated access should resolve to the sign-in boundary or authenticated UI, not a 404 or 500.", evidence: "Record which routes were checked and whether each route returned sign-in/authenticated UI.", href: "/portal/workspace", action: "Open workspace" },
      { id: "cron-auth-boundary", title: "3. Confirm secured cron boundary", detail: "Open /api/cron/leads/aging without Authorization. It must return 401 Unauthorized. Do not run the cron with CRON_SECRET during this acceptance step.", evidence: "Expected unauthenticated response: HTTP 401 with {\"error\":\"Unauthorized.\"}.", href: "/api/cron/leads/aging", action: "Check cron" },
      { id: "runtime-error-log-check", title: "4. Confirm latest deployment runtime logs", detail: "Check Vercel runtime logs for the latest production deployment and confirm there are no error or fatal logs in the reviewed window.", evidence: "Record the deployment ID, time window, and whether error/fatal logs were found." },
      { id: "corrected-batch-state", title: "5. Confirm corrected production Lead state", detail: "Confirm the first imported batch remains 50 COLD / AVAILABLE Leads, 0 OPEN / AVAILABLE claimable Leads, and correction audit evidence exists. This should be read-only verification.", evidence: "Record count evidence only. Do not move Leads or change production data for this step.", href: "/admin/leads", action: "Review Leads" },
    ],
  },
  {
    title: "Authenticated Lead Flow acceptance",
    detail: "Controlled test-agent checks for the deployed Lead Flow business rules on the production custom domain.",
    steps: [
      { id: "cold-lead-visibility", title: "6. Verify Cold Lead workspace visibility", detail: "A certified test agent should see unowned COLD / AVAILABLE records in /portal/leads. The workspace should present this as activity-first work, not an ownership queue.", evidence: "Record the test agent and the Lead state observed. Do not include sensitive contact payloads.", href: "/portal/leads", action: "Open Cold Leads" },
      { id: "click-to-call-logs-first", title: "7. Verify click-to-call logs activity first", detail: "Use the Cold Lead click-to-call button. Confirm it calls /api/portal/leads/call-start, writes CALL_INITIATED evidence, and only then opens the device dialer.", evidence: "Record the activity/audit evidence and confirm no ownership was created by call start.", href: "/portal/leads", action: "Test click-to-call" },
      { id: "click-to-call-blocks-on-error", title: "8. Verify dialer blocks if logging fails", detail: "Confirm the client has no fallback dial link after an API/logging failure. The dialer must not open when call activity cannot be logged first.", evidence: "Record the failure path reviewed or tested and the user-facing message observed.", href: "/portal/leads", action: "Review failure path" },
      { id: "no-answer-boundary", title: "9. Verify no-answer and voicemail stay unowned", detail: "Record No Answer and Voicemail outcomes on controlled Cold Leads. Confirm each Lead remains unowned and not claimable from that outcome alone.", evidence: "Record lifecycle/pool/owner claim state before and after the disposition.", href: "/portal/leads", action: "Record no-answer" },
      { id: "two-way-contact-claim-gate", title: "10. Verify two-way-contact claim gate", detail: "Record callback-requested, qualified, or follow-up on a controlled Cold Lead. Confirm twoWayContactAt is recorded, the Lead becomes claim eligible, and claim is still not automatic.", evidence: "Record twoWayContactAt, pool/lifecycle transition, and claim eligibility state.", href: "/portal/leads", action: "Test claim gate" },
      { id: "claim-responsibility-timer", title: "11. Verify claim starts 45-day timer", detail: "Claim an eligible Lead only after two-way contact. Confirm ownerAgentId, claimedAt, lifecycle CLAIMED, and openPoolReleaseAt about 45 days after claim are set with audit/activity evidence.", evidence: "Record claimedAt and openPoolReleaseAt. Do not expose contact details.", href: "/portal/leads", action: "Claim eligible Lead" },
      { id: "dnc-blackout", title: "12. Verify DNC absolute blackout", detail: "Apply DNC from unowned Cold Lead flow and owned Lead flow. Confirm callbacks cancel, the record is suppressed, and the Lead disappears from sales workflows.", evidence: "Record suppression, DNC, and callback cancellation evidence.", href: "/portal/leads", action: "Test DNC" },
      { id: "my-workspace-dashboard", title: "13. Verify My Workspace dashboard", detail: "Open /portal/workspace without leadId. Confirm it shows assigned records, callback queue, claim access, recent activity, DNC reminder, and claim-timer responsibility instead of returning not found.", evidence: "Record visible sections and confirm no selected Lead is required to load the dashboard.", href: "/portal/workspace", action: "Open My Workspace" },
    ],
  },
  {
    title: "Relay, timer, and owner decision gates",
    detail: "Checks that remain controlled and do not activate broader live workflows unless separately approved.",
    steps: [
      { id: "warm-reply-timer", title: "14. Verify Warm Reply Triage timer", detail: "Assign an eligible unowned warm reply. Confirm two-way contact is required, a callback is created, and openPoolReleaseAt starts at about 45 days after assignment.", evidence: "Record assignment, callback, and openPoolReleaseAt evidence.", href: "/admin/leads/replies", action: "Open warm replies" },
      { id: "ghl-appointment-hardening", title: "15. Verify GHL appointment hardening", detail: "Use controlled test events only. Confirm suppressed/DNC Leads are ignored, booked/confirmed/rescheduled events record two-way contact, cancelled/no-show events create or expedite one callback, and Closed Won is preserved.", evidence: "Record webhook outcome fields and audit evidence. Do not enable live workflow automation from this board.", href: "/admin/integrations", action: "Open integrations" },
      { id: "ghl-opportunity-hardening", title: "16. Verify GHL opportunity hardening", detail: "Use controlled Won/Lost events only. Confirm terminal outcomes cancel scheduled callbacks, suppressed/DNC Leads are ignored, and late Lost cannot roll back Closed Won.", evidence: "Record webhook outcome fields and callback cancellation/preservation evidence.", href: "/admin/integrations", action: "Open integrations" },
      { id: "aging-sweep-contract", title: "17. Verify aging sweep contract", detail: "Verify the secured route requires Authorization, then use controlled test data only to confirm expired owned Leads return to Open Pool and 21-day stale Open Pool records move to Shark Tank with audit evidence.", evidence: "Record test data identifiers and audit evidence. Do not run the live cron against uncontrolled records.", href: "/api/cron/leads/aging", action: "Check cron route" },
      { id: "owner-production-decision", title: "18. Record owner production decision", detail: "Record the owner decision for normal Lead Flow use after production acceptance. This does not activate GHL workflows, Servicing, Commissions, Finance, or additional imports.", evidence: "Record approved use boundary, remaining gates, and the next merge section.", href: "/admin/audit", action: "Open audit history" },
    ],
  },
];

export const leadProductionAcceptanceSteps = leadProductionAcceptanceGroups.flatMap((group) => group.steps);

export function readLeadProductionAcceptanceOutcome(metadata: unknown): LeadProductionAcceptanceOutcome | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const outcome = (metadata as { outcome?: unknown }).outcome;
  return outcome === "PASS" || outcome === "FAIL" || outcome === "DEFERRED" ? outcome : null;
}

export function readLeadProductionAcceptanceMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const source = metadata as Record<string, unknown>;
  return {
    module: typeof source.module === "string" ? source.module : undefined,
    phase: typeof source.phase === "string" ? source.phase : undefined,
    outcome: readLeadProductionAcceptanceOutcome(metadata),
    stepId: typeof source.stepId === "string" ? source.stepId : undefined,
    stepTitle: typeof source.stepTitle === "string" ? source.stepTitle : undefined,
    expectedCommit: typeof source.expectedCommit === "string" ? source.expectedCommit : undefined,
    statusBaselineCommit: typeof source.statusBaselineCommit === "string" ? source.statusBaselineCommit : undefined,
  };
}
