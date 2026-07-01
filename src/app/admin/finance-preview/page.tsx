import { CommissionPreviewForm } from "@/components/commission-preview-form";
import { requireRole } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function FinancePreviewPage() {
  await requireRole(["OWNER", "SUPER_ADMIN", "FINANCE_MANAGER"]);
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Commission preview</h1>
      <p className="mt-2 text-gray-400">Preview only. This does not create a ledger entry, approve a payout, or move money.</p>
      <CommissionPreviewForm />
    </main>
  );
}
