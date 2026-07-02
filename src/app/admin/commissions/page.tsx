import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";

export const dynamic = "force-dynamic";

export default async function CommissionReviewPage() {
  const user = await requireRole(ADMIN_ROLES);
  const enabled = features.commissions;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Commission eligibility</h1>
      <p className="mt-3 max-w-3xl text-gray-400">Eligibility review is separate from payment execution. This workspace does not release funds or connect to a payment provider.</p>
      <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <p className="text-sm text-gray-300">Feature status: <strong>{enabled ? "Controlled test enabled" : "Staged and locked"}</strong></p>
        <ul className="mt-5 space-y-2 text-sm text-gray-300">
          <li>Active servicing ownership is required for active-agent eligibility.</li>
          <li>Retired agents retain existing-client eligibility.</li>
          <li>Terminated agents are not eligible for future entries.</li>
          <li>Uncleared payments, refunds, chargebacks, and manual reviews remain on hold.</li>
        </ul>
        <p className="mt-6 text-xs text-gray-500">Admin session: {user.email}</p>
      </section>
    </main>
  );
}
