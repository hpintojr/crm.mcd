import Link from "next/link";
import { notFound } from "next/navigation";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";
import { LEAD_STATUS_BASELINE_COMMIT } from "@/lib/lead-production-acceptance";

export const dynamic = "force-dynamic";

type ChecklistStep = {
  id: string;
  title: string;
  evidence: string;
};

const CHECKLIST_STEPS: ChecklistStep[] = [
  {
    id: "open-command-center",
    title: "1. Open the Lead acceptance command center",
    evidence:
      "Screenshot or note the next-safe-action banner and the deployment status baseline commit before starting.",
  },
  {
    id: "seed-controlled-data",
    title: "2. Seed controlled test data",
    evidence:
      "Record the controlled Lead IDs created. Confirm GHL export is blocked by default.",
  },
  {
    id: "click-to-call",
    title: "3. Verify click-to-call logs activity first",
    evidence:
      "Activity audit written before dialer opens; dialer blocked if activity logging fails.",
  },
  {
    id: "no-answer-ownership",
    title: "4. Verify no-answer and voicemail stay unowned",
    evidence:
      "Lead remains unowned, no reservation, returns to Cold pool. Repeat for voicemail outcome.",
  },
  {
    id: "two-way-contact-claim",
    title: "5. Verify the two-way-contact claim gate",
    evidence:
      "Owner and claimedAt populated; 45-day openPoolReleaseAt set from two-way-contact timestamp.",
  },
  {
    id: "warm-reply-timer",
    title: "6. Verify the Warm Reply Triage 45-day timer",
    evidence:
      "Timer starts from assignment timestamp; ownership/release fields align with rule.",
  },
  {
    id: "dnc-blackout",
    title: "7. Verify DNC suppresses and cancels callbacks",
    evidence:
      "Cold Lead suppressed; queued callbacks cancelled; unowned Cold Leads honor DNC blackout.",
  },
  {
    id: "ghl-controlled-events",
    title: "8. Verify GHL appointment and opportunity events (controlled only)",
    evidence:
      "Controlled harness only. Ignored appointments and preserved-lost opportunities produce expected audit outcomes without touching live GHL.",
  },
  {
    id: "aging-preview",
    title: "9. Confirm the aging sweep dry-run",
    evidence:
      "Response reports mutationPerformed:false and expected wouldReturnToOpenPool candidates.",
  },
  {
    id: "record-evidence",
    title: "10. Record acceptance evidence on the acceptance board",
    evidence:
      "Pass / fail / deferred recorded for each step with notes and, where relevant, commit evidence.",
  },
  {
    id: "owner-decision",
    title: "11. Record the owner production decision",
    evidence:
      "Recorded only when all non-owner-decision steps are pass-ready with no failures or deferrals.",
  },
];

const CLOSED_GATES = [
  "Live GHL workflow activation",
  "Additional live imports or exports",
  "Servicing module expansion",
  "Commission or payout activation",
  "Finance or client-onboarding activation",
  "Production data changes outside controlled-test actions",
];

const PRINT_CSS = `
@media print {
  html, body { background: #ffffff !important; color: #111111 !important; }
  main { max-width: none !important; padding: 0.5in !important; }
  .no-print { display: none !important; }
  article, section, div { break-inside: avoid; page-break-inside: avoid; }
  a { color: #111111 !important; text-decoration: none !important; }
  .print-box {
    border: 1px solid #111111 !important;
    background: transparent !important;
    color: #111111 !important;
  }
  .print-checkbox {
    border: 1px solid #111111 !important;
    background: transparent !important;
  }
  .print-muted { color: #444444 !important; }
}
`;

export default async function LeadAcceptanceRunbookChecklistPage() {
  if (!features.leads) notFound();
  const actor = await requireRole(ADMIN_ROLES);
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <main
      className="mx-auto min-h-screen max-w-4xl px-6 py-10"
      data-acceptance-runbook-checklist="lead-flow"
    >
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400 print-muted">
            Mercury Call Desk
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white print-box:hidden">
            Lead acceptance runbook — printable checklist
          </h1>
          <p className="mt-2 max-w-3xl text-gray-400 print-muted">
            Condensed one-per-step checklist mirroring the runbook. Print or fill in as you go.
            This page is read-only content; it does not mutate Leads, change feature flags, or
            activate any live operations.
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Link
            className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200"
            href="/admin/leads/acceptance-runbook"
          >
            Full runbook
          </Link>
          <Link
            className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200"
            href="/admin/leads/acceptance-command-center"
          >
            Command center
          </Link>
          <Link
            className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200"
            href="/admin/leads/testing"
          >
            Acceptance board
          </Link>
        </div>
      </div>

      <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-5 print-box">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Date" value={todayIso} />
          <Field label="Operator" value={actor.email} />
          <Field label="Baseline commit" value={LEAD_STATUS_BASELINE_COMMIT} />
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-amber-900 bg-amber-950/20 p-5 print-box">
        <h2 className="font-semibold text-amber-100">Gates that remain closed</h2>
        <ul className="mt-3 grid list-disc gap-1 pl-5 text-sm text-amber-100/90 sm:grid-cols-2">
          {CLOSED_GATES.map((gate) => (
            <li key={gate}>{gate}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        {CHECKLIST_STEPS.map((step) => (
          <article
            className="rounded-xl border border-ink-700 bg-ink-900 p-4 print-box"
            data-checklist-step={step.id}
            key={step.id}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <h3 className="font-medium text-white">{step.title}</h3>
                <p className="mt-1 text-sm leading-6 text-gray-400 print-muted">
                  Evidence: {step.evidence}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-widest text-gray-300 print-muted">
                <Choice label="Pass" />
                <Choice label="Fail" />
                <Choice label="Deferred" />
              </div>
            </div>
            <div className="mt-3 border-t border-ink-700 pt-3 print-box">
              <p className="text-xs uppercase tracking-widest text-gray-500 print-muted">Notes</p>
              <div className="mt-2 h-12 rounded-md border border-dashed border-ink-700 print-checkbox" />
            </div>
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-5 print-box">
        <h2 className="font-semibold text-white">Sign-off</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Reviewer signature" value="" />
          <Field label="Owner production decision" value="" />
        </div>
        <p className="mt-4 text-xs leading-5 text-gray-500 print-muted">
          Recorded evidence must also be entered on the acceptance board at{" "}
          <Link className="text-brand-200 underline" href="/admin/leads/testing">
            /admin/leads/testing
          </Link>{" "}
          to be captured in the immutable audit log. This printout is a workflow aid only.
        </p>
      </section>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-950 p-3 print-box">
      <p className="text-xs uppercase tracking-widest text-gray-500 print-muted">{label}</p>
      <p className="mt-1 break-all text-sm text-gray-100 print-muted">{value || " "}</p>
    </div>
  );
}

function Choice({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className="inline-block h-4 w-4 rounded border border-ink-500 print-checkbox"
      />
      {label}
    </span>
  );
}
