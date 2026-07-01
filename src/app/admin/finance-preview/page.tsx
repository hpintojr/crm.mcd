import { revalidatePath } from "next/cache";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { calculateFiftyFiftyCommission } from "@/lib/commission-math";

export const dynamic = "force-dynamic";

type Preview = ReturnType<typeof calculateFiftyFiftyCommission> | null;
let lastPreview: Preview = null;

function dollars(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default async function FinancePreviewPage() {
  await requireRole(["OWNER", "SUPER_ADMIN", "FINANCE_MANAGER"]);

  async function calculate(formData: FormData) {
    "use server";
    await requireRole(["OWNER", "SUPER_ADMIN", "FINANCE_MANAGER"]);
    const read = (name: string) => Math.round(Number(formData.get(name) ?? 0) * 100);
    lastPreview = calculateFiftyFiftyCommission({
      collectedCents: read("collected"),
      wholesaleCents: read("wholesale"),
      processingFeeCents: read("fee"),
      taxCents: read("tax"),
      minProfitCents: read("minimum"),
    });
    revalidatePath("/admin/finance-preview");
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Commission preview</h1>
      <p className="mt-2 text-gray-400">Preview only. This does not create a ledger entry, approve a payout, or move money.</p>
      <form action={calculate} className="mt-8 grid gap-4 rounded-2xl border border-ink-700 bg-ink-900 p-6 sm:grid-cols-2">
        {[['collected','Collected amount'],['wholesale','Wholesale cost'],['fee','Processing fee'],['tax','Tax amount'],['minimum','Minimum profit']].map(([name,label]) => <label className="text-sm text-gray-300" key={name}>{label}<input className="mt-1 block w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-gray-100" defaultValue="0" min="0" name={name} step="0.01" type="number" /></label>)}
        <div className="sm:col-span-2"><button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950" type="submit">Calculate preview</button></div>
      </form>
      {lastPreview && <section className="mt-6 grid gap-4 rounded-2xl border border-ink-700 bg-ink-900 p-6 sm:grid-cols-2"><p className="text-gray-300">Collected excluding tax <strong className="ml-2 text-white">{dollars(lastPreview.collectedExcludingTaxCents)}</strong></p><p className="text-gray-300">Net commissionable profit <strong className="ml-2 text-white">{dollars(lastPreview.netCommissionableProfitCents)}</strong></p><p className="text-gray-300">Agent share <strong className="ml-2 text-emerald-300">{dollars(lastPreview.agentShareCents)}</strong></p><p className="text-gray-300">Company share <strong className="ml-2 text-white">{dollars(lastPreview.companyShareCents)}</strong></p><p className="text-sm text-gray-500 sm:col-span-2">Minimum-profit requirement: {lastPreview.meetsMinimumProfit ? "met" : "not met"}</p></section>}
    </main>
  );
}
