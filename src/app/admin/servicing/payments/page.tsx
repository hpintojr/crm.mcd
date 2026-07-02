import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";
import { listAdminServicingAccounts } from "@/lib/client-servicing";
import { recordPaymentResolved } from "@/lib/client-servicing-resolution";

export const dynamic = "force-dynamic";

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

export default async function ServicingPaymentsPage() {
  await requireRole(ADMIN_ROLES);
  if (!features.servicing) return <main className="mx-auto min-h-screen max-w-5xl px-6 py-12"><h1 className="text-3xl font-semibold text-white">Payment health</h1><p className="mt-3 text-gray-400">This workspace is held behind the Client Servicing Health feature gate.</p></main>;
  const accounts = await listAdminServicingAccounts();

  async function resolvePayment(formData: FormData) {
    "use server";
    await recordPaymentResolved({ clientAccountId: String(formData.get("clientAccountId") ?? ""), note: String(formData.get("note") ?? "") });
    revalidatePath("/admin/servicing/payments");
    revalidatePath("/admin/servicing");
    revalidatePath("/portal/servicing");
  }

  return <main className="mx-auto min-h-screen max-w-6xl px-6 py-12"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">Payment health</h1><p className="mt-2 text-gray-400">Use only after the payment issue has been confirmed resolved. This updates service health; it does not approve a commission or payout.</p></div><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/servicing">Client servicing</Link></div><section className="mt-8 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900"><div className="border-b border-ink-700 px-6 py-4"><h2 className="font-semibold text-white">Accounts with payment health context</h2></div>{accounts.length === 0 ? <p className="px-6 py-10 text-sm text-gray-400">No client accounts are available.</p> : <div className="divide-y divide-ink-700">{accounts.map((account) => <article className="flex flex-col justify-between gap-4 px-6 py-5 lg:flex-row lg:items-center" key={account.id}><div><p className="font-medium text-white">{account.clientName}</p><p className="mt-1 text-sm text-gray-400">{label(account.healthStatus)} · {account.currentOnPayments ? "Current" : "Payment issue"}</p></div><form action={resolvePayment} className="grid min-w-[22rem] grid-cols-[1fr_auto] gap-2"><input name="clientAccountId" type="hidden" value={account.id} /><input className="min-w-0 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="note" placeholder="Confirmed payment resolution reference" required /><button className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" type="submit">Mark resolved</button></form></article>)}</div>}</section></main>;
}
