import Link from "next/link";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";

export const dynamic = "force-dynamic";

export default async function FinanceReadinessPage() {
  const user = await requireRole(ADMIN_ROLES);
  const enabled = features.finance;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Finance readiness</h1>
      <p className="mt-3 max-w-4xl text-gray-400">Finance is a later, separately controlled phase. This page is a readiness boundary only; it has no payment instruction, financial-account storage, or money-movement action.</p>
      <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <p className="text-sm text-gray-300">Feature status: <strong>{enabled ? "Controlled test enabled" : "Staged and locked"}</strong></p>
        <ol className="mt-5 space-y-3 text-sm text-gray-300">
          <li>1. Commission eligibility is current and approved.</li>
          <li>2. The underlying payment is cleared.</li>
          <li>3. No active refund, chargeback, compliance, ownership, or manual hold exists.</li>
          <li>4. Finance approval is documented.</li>
          <li>5. A verified destination reference exists outside the CRM; raw account details are never stored here.</li>
          <li>6. A human performs any final external financial action outside this readiness page.</li>
        </ol>
        <div className="mt-6 flex flex-wrap gap-2"><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/commissions">Commission eligibility</Link><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/operating-status">Operating status</Link></div>
        <p className="mt-6 text-xs text-gray-500">Admin session: {user.email}</p>
      </section>
    </main>
  );
}
