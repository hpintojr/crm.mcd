import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { confirmClientLaunch } from "@/lib/client-servicing-actions";
import { db } from "@/lib/db";
import { features } from "@/lib/features";

export const dynamic = "force-dynamic";

type LaunchRow = { id: string; clientName: string; packageCode: string; currentOnPayments: boolean; createdAt: Date };

function pacific(value: Date) {
  return value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" });
}

export default async function LaunchQueuePage() {
  if (!features.servicing) notFound();
  await requireRole(ADMIN_ROLES);
  const accounts = await db.$queryRaw<LaunchRow[]>(Prisma.sql`
    SELECT "id", "clientName", "packageCode", "currentOnPayments", "createdAt"
    FROM "ClientAccount"
    WHERE "launchChecklistComplete"=false
      AND "status"='PENDING_LAUNCH'::"ClientAccountStatus"
    ORDER BY "createdAt" ASC
    LIMIT 100
  `);

  async function confirmLaunch(formData: FormData) {
    "use server";
    await confirmClientLaunch({
      clientAccountId: String(formData.get("clientAccountId") ?? ""),
      paymentState: String(formData.get("paymentState") ?? "CURRENT") as "CURRENT" | "PAYMENT_ISSUE",
      note: String(formData.get("note") ?? ""),
    });
    revalidatePath("/admin/servicing/launches");
    revalidatePath("/admin/servicing");
    revalidatePath("/admin/readiness");
    revalidatePath("/admin/audit");
  }

  return <main className="mx-auto min-h-screen max-w-6xl px-6 py-12"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">Launch confirmations</h1><p className="mt-2 text-gray-400">Client accounts that exist but still need a documented launch confirmation before normal service workflow begins.</p></div><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/servicing">Client servicing</Link></div><section className="mt-6 rounded-xl border border-ink-700 bg-ink-900 px-5 py-4 text-sm text-gray-300">Confirming launch records the documented account state only. It does not collect a payment, create a commission, approve a payout, or invoke Finance.</section><section className="mt-8 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">{accounts.length === 0 ? <p className="px-6 py-10 text-sm text-gray-400">No launch confirmations are pending.</p> : <div className="divide-y divide-ink-700">{accounts.map((account) => <article className="px-6 py-5" key={account.id}><div><p className="font-medium text-white">{account.clientName}</p><p className="mt-1 text-sm text-gray-400">{account.packageCode} · {account.currentOnPayments ? "Current" : "Payment issue"}</p><p className="mt-1 text-xs text-gray-500">Created {pacific(account.createdAt)}</p></div><form action={confirmLaunch} className="mt-5 grid gap-3 border-t border-ink-700 pt-5 lg:grid-cols-[auto_1fr_auto]"><input name="clientAccountId" type="hidden" value={account.id} /><select className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" defaultValue="CURRENT" name="paymentState"><option value="CURRENT">Current on payments</option><option value="PAYMENT_ISSUE">Payment issue</option></select><input className="min-w-0 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="note" placeholder="Launch confirmation evidence" required /><button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950" type="submit">Confirm launch</button></form></article>)}</div>}</section></main>;
}
