import Link from "next/link";
import { notFound } from "next/navigation";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";
import { LEAD_STATUS_BASELINE_COMMIT } from "@/lib/lead-production-acceptance";

export const dynamic = "force-dynamic";

type RunbookStep = {
  id: string;
  title: string;
  detail: string;
  actions: { href: string; label: string }[];
  notes?: string[];
};

const RUNBOOK_STEPS: RunbookStep[] = [
  {
    id: "open-command-center",
    title: "1. Open the Lead acceptance command center",
    detail:
      "Start at the read-only command center. Confirm the next safe action banner, verify the deployment status baseline commit, and scan the acceptance groups for outstanding steps before doing anything else.",
    actions: [
      { href: "/admin/leads/acceptance-command-center", label: "Command center" },
      { href: "/admin/leads/acceptance-report", label: "Acceptance report" },
    ],
  },
  {
    id: "seed-controlled-data",
    title: "2. Seed controlled test data",
    detail:
      "Use the controlled test data page to create the controlled Leads you need for the acceptance run. Controlled Leads are the only Leads permitted for acceptance interaction; they are blocked from GHL export by default.",
    actions: [
      { href: "/admin/leads/controlled-test-data", label: "Controlled test data" },
    ],
    notes: [
      "Never touch a real production Lead as part of acceptance.",
      "Archive controlled Leads when the acceptance run finishes.",
    ],
  },
  {
    id: "click-to-call",
    title: "3. Verify click-to-call logs activity first",
    detail:
      "From /portal/leads in agent-friendly mode, click the dial button on a controlled Cold Lead. Confirm the activity log entry is written before the dialer opens, and confirm the dialer is blocked when activity logging fails.",
    actions: [
      { href: "/portal/leads?mode=agent", label: "Agent-friendly Lead workspace" },
      { href: "/admin/audit?action=controlled", label: "Audit timeline" },
    ],
  },
  {
    id: "no-answer-ownership",
    title: "4. Verify no-answer and voicemail stay unowned",
    detail:
      "Log a no-answer outcome on the controlled Cold Lead. The Lead must remain unowned with no reservation, and it must return to the Cold pool for other agents. Repeat with a voicemail outcome.",
    actions: [
      { href: "/portal/leads?mode=agent", label: "Agent-friendly Lead workspace" },
      { href: "/admin/leads", label: "Lead review" },
    ],
  },
  {
    id: "two-way-contact-claim",
    title: "5. Verify the two-way-contact claim gate",
    detail:
      "Simulate a two-way contact outcome (callback, qualified, or follow-up). Confirm the claim now succeeds, that owner and claimedAt are populated, and that the 45-day openPoolReleaseAt is set from the two-way-contact timestamp.",
    actions: [
      { href: "/portal/workspace", label: "My Workspace" },
      { href: "/admin/leads", label: "Lead review" },
    ],
  },
  {
    id: "warm-reply-timer",
    title: "6. Verify the Warm Reply Triage 45-day timer",
    detail:
      "From the warm reply triage page, assign a controlled warm reply. Confirm the 45-day responsibility timer starts from the assignment timestamp and that the ownership and release fields align with the two-way-contact rule.",
    actions: [
      { href: "/admin/leads/replies", label: "Warm reply triage" },
    ],
  },
  {
    id: "dnc-blackout",
    title: "7. Verify DNC suppresses and cancels callbacks",
    detail:
      "Mark a controlled Lead as DNC. Confirm it is suppressed from the Cold Lead workspace, that any queued callbacks are cancelled, and that unowned Cold Leads honor the DNC blackout without exceptions.",
    actions: [
      { href: "/portal/leads?mode=agent", label: "Agent-friendly Lead workspace" },
      { href: "/admin/leads", label: "Lead review" },
    ],
  },
  {
    id: "ghl-controlled-events",
    title: "8. Verify GHL appointment and opportunity events (controlled only)",
    detail:
      "Only use the controlled GHL event harness. Apply a controlled appointment simulation and a controlled opportunity simulation, and confirm that ignored appointments and preserved-lost opportunities produce the expected audit outcomes without touching live GHL workflows.",
    actions: [
      { href: "/admin/integrations/test-events", label: "Controlled GHL event harness" },
      { href: "/admin/integrations", label: "Integration monitor" },
    ],
    notes: [
      "Live GHL workflow activation stays closed. This step exercises the harness only.",
    ],
  },
  {
    id: "aging-preview",
    title: "9. Confirm the aging sweep dry-run",
    detail:
      "Call the aging dry-run preview endpoint and confirm the response reports mutationPerformed:false, the expected wouldReturnToOpenPool candidates, and no live Lead mutations.",
    actions: [
      { href: "/api/admin/leads/aging-preview", label: "Aging dry-run preview" },
      { href: "/admin/audit?action=acceptance", label: "Audit timeline" },
    ],
  },
  {
    id: "record-evidence",
    title: "10. Record acceptance evidence on the acceptance board",
    detail:
      "On the acceptance board, record pass/fail/deferred for each step you executed. Attach the recorded note and, where relevant, the commit evidence for the deployment used during acceptance.",
    actions: [
      { href: "/admin/leads/testing", label: "Acceptance board" },
      { href: "/admin/leads/acceptance-report", label: "Acceptance report" },
    ],
  },
  {
    id: "owner-decision",
    title: "11. Record the owner production decision",
    detail:
      "When all non-owner-decision steps are pass-ready with no failures or deferrals, record the owner production decision on the acceptance board. The command center owner-decision-ready state must confirm before this step is used.",
    actions: [
      { href: "/admin/leads/testing", label: "Acceptance board" },
      { href: "/admin/leads/acceptance-command-center", label: "Command center" },
    ],
  },
];

export default async function LeadAcceptanceRunbookPage() {
  if (!features.leads) notFound();
  const actor = await requireRole(ADMIN_ROLES);

  return (
    <main
      className="mx-auto min-h-screen max-w-7xl px-6 py-12"
      data-acceptance-runbook="lead-flow"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">
            Mercury Call Desk
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Lead acceptance runbook
          </h1>
          <p className="mt-2 max-w-4xl text-gray-400">
            Step-by-step instructions for executing authenticated production Lead
            Flow acceptance using the command center, acceptance board, controlled
            test data, controlled GHL harness, aging preview, audit history, and
            acceptance report. This page is read-only content. It does not mutate
            Leads, change feature flags, or activate any live operations.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200"
            href="/admin/leads/acceptance-command-center"
          >
            Command center
          </Link>
          <Link
            className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200"
            href="/admin/leads/acceptance-report"
          >
            Acceptance report
          </Link>
          <Link
            className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200"
            href="/admin/leads/testing"
          >
            Acceptance board
          </Link>
        </div>
      </div>

      <section className="mt-8 rounded-2xl border border-amber-900 bg-amber-950/20 p-6">
        <h2 className="font-semibold text-amber-100">Gates that remain closed</h2>
        <p className="mt-2 text-sm leading-6 text-amber-100/80">
          The following gates stay closed during acceptance and are only opened
          under separately approved scope. This runbook does not change any of
          them; it only describes how to execute acceptance safely.
        </p>
        <div className="mt-4 grid gap-3 text-sm text-amber-100/90 md:grid-cols-2">
          <Gate label="Live GHL workflow activation" />
          <Gate label="Additional live imports or exports" />
          <Gate label="Servicing module expansion" />
          <Gate label="Commission or payout activation" />
          <Gate label="Finance or client-onboarding activation" />
          <Gate label="Production data changes outside controlled-test actions" />
        </div>
      </section>

      <section className="mt-8 space-y-4">
        {RUNBOOK_STEPS.map((step) => (
          <article
            className="rounded-2xl border border-ink-700 bg-ink-900 p-6"
            data-acceptance-runbook-step={step.id}
            key={step.id}
          >
            <h2 className="font-semibold text-white">{step.title}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-300">{step.detail}</p>
            {step.notes && step.notes.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5 text-amber-100/80">
                {step.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {step.actions.map((action) => (
                <Link
                  className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200"
                  href={action.href}
                  key={`${step.id}-${action.href}`}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <h2 className="font-semibold text-white">Runbook session</h2>
        <p className="mt-2 text-sm text-gray-400">
          Viewed by {actor.email}. Deployment status baseline:{" "}
          <span className="break-all text-gray-500">
            {LEAD_STATUS_BASELINE_COMMIT}
          </span>
          . Return to the{" "}
          <Link
            className="text-brand-200 underline"
            href="/admin/leads/acceptance-command-center"
          >
            command center
          </Link>{" "}
          when you are ready to record evidence.
        </p>
      </section>
    </main>
  );
}

function Gate({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-amber-900/70 bg-ink-950/60 px-3 py-2">
      {label}
    </div>
  );
}
