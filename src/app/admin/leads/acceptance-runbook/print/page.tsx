import Link from "next/link";
import { notFound } from "next/navigation";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";
import { acceptanceRunbookHref } from "@/lib/acceptance-runbook-links";
import { LEAD_STATUS_BASELINE_COMMIT, leadProductionAcceptanceGroups } from "@/lib/lead-production-acceptance";

export const dynamic = "force-dynamic";

const CLOSED_GATES = [
  "Live GHL workflow activation",
  "Additional live imports or exports",
  "Servicing module expansion",
  "Commission or payout activation",
  "Finance or client-onboarding activation",
  "Production data changes outside controlled-test actions",
];

export default async function LeadAcceptanceRunbookPrintPage() {
  if (!features.leads) notFound();
  const actor = await requireRole(ADMIN_ROLES);

  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-white px-6 py-10 text-slate-950 print:max-w-none print:px-0 print:py-0" data-acceptance-runbook-print="lead-flow">
      <style>{`
        @media print {
          @page { margin: 0.45in; }
          body { background: white !important; }
          a { color: inherit; text-decoration: none; }
          .print-break-inside-avoid { break-inside: avoid; }
        }
      `}</style>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-slate-300 pb-5 print:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Mercury Call Desk</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">Lead acceptance runbook — print view</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Compact read-only print view for the 18 production-acceptance steps. Use the browser print dialog to save or print this runbook.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700" href="/admin/leads/acceptance-runbook">Full runbook</Link>
          <Link className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700" href="/admin/leads/acceptance-runbook/checklist">Checklist</Link>
          <Link className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700" href="/admin/leads/acceptance-runbook/deferred">Deferred steps</Link>
          <Link className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700" href="/admin/leads/acceptance-overview">Overview</Link>
        </div>
      </div>

      <header className="print-break-inside-avoid">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Mercury Call Desk</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Lead acceptance runbook</h1>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Print-friendly read-only operator reference for authenticated production Lead Flow acceptance. This page does not mutate Leads, audit records, feature flags, GHL workflows, imports, exports, commissions, payouts, finance, client onboarding, or business rules.
        </p>
        <p className="mt-2 break-all text-xs text-slate-500">Deployment status baseline: {LEAD_STATUS_BASELINE_COMMIT}</p>
      </header>

      <section className="print-break-inside-avoid mt-6 rounded-xl border border-slate-300 p-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-700">Closed gates during acceptance</h2>
        <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
          {CLOSED_GATES.map((gate) => (
            <div className="rounded-lg border border-slate-200 px-3 py-2" key={gate}>{gate}</div>
          ))}
        </div>
      </section>

      <section className="mt-6 space-y-5">
        {leadProductionAcceptanceGroups.map((group) => (
          <article className="print-break-inside-avoid rounded-xl border border-slate-300 p-4" key={group.title}>
            <h2 className="text-lg font-bold text-slate-950">{group.title}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">{group.detail}</p>
            <table className="mt-3 w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-300 text-slate-500">
                  <th className="py-2 pr-3 font-semibold">Step</th>
                  <th className="px-3 py-2 font-semibold">Evidence to record</th>
                  <th className="py-2 pl-3 font-semibold">Where to record</th>
                </tr>
              </thead>
              <tbody className="align-top text-slate-800">
                {group.steps.map((step) => (
                  <tr className="border-b border-slate-200 last:border-0" key={step.id}>
                    <td className="w-1/3 py-2 pr-3">
                      <p className="font-semibold text-slate-950">{step.title}</p>
                      <p className="mt-1 text-[11px] leading-4 text-slate-600">{step.detail}</p>
                    </td>
                    <td className="px-3 py-2 leading-5">{step.evidence}</td>
                    <td className="py-2 pl-3 leading-5">
                      <p>/admin/leads/testing#{step.id}</p>
                      <p className="mt-1 text-slate-500">Runbook: {acceptanceRunbookHref(step.id)}</p>
                      {step.href && <p className="mt-1 text-slate-500">Perform: {step.href}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        ))}
      </section>

      <footer className="mt-6 border-t border-slate-300 pt-4 text-xs leading-5 text-slate-500">
        <p>Viewed by {actor.email}. This print view is read-only and protected by ADMIN role access.</p>
      </footer>
    </main>
  );
}
