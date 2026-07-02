import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { completeClientLaunch } from "@/lib/client-launch-actions";

export const dynamic = "force-dynamic";

type AccountRow = {
  id: string;
  clientName: string;
  packageCode: string;
  status: string;
  healthStatus: string;
  currentOnPayments: boolean;
  launchChecklistComplete: boolean;
  launchCompletedAt: Date | null;
};

function pacific(value: Date | null) {
  return value ? value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" }) : "—";
}

export default async function ClientLaunchPage({ params }: { params: Promise<{ clientAccountId: string }> }) {
  if (!features.servicing) notFound();
  await requireRole(ADMIN_ROLES);
  const { clientAccountId } = await params;
  const rows = await db.$queryRaw<AccountRow[]>(Prisma.sql`
    SELECT "id", "clientName", "packageCode", "status"::text AS "status", "healthStatus"::text AS "healthStatus", "currentOnPayments", "launchChecklistComplete", "launchCompletedAt"
    FROM "ClientAccount" WHERE "id"=${clientAccountId}
  `);
  const account = rows[0];
  if (!account) notFound();

  async function complete(formData: FormData) {
    "use server";
    await completeClientLaunch({ clientAccountId, note: String(formData.get("note") ?? "") });
    redirect(`/admin/servicing/${clientAccountId}`);
  }

  return <main className="mx-auto min-h-screen max-w-3xl px-6 py-12"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">Client launch confirmation</h1><p className="mt-2 text-gray-400">Document that the client is launched and ready for normal service workflow. This is not a payment, commission, or payout approval.</p></div><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href={`/admin/servicing/${account.id}`}>Client detail</Link></div><section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6"><h2 className="text-lg font-semibold text-white">{account.clientName}</h2><p className="mt-1 text-sm text-gray-400">{account.packageCode} · Current payment standing: {account.currentOnPayments ? "Current" : "Payment issue"}</p>{account.launchChecklistComplete ? <div className="mt-6 rounded-xl border border-emerald-700/70 bg-emerald-950/20 p-4 text-sm text-emerald-200">Launch already completed {pacific(account.launchCompletedAt)}. Use Client Service detail to review the recorded activity.</div> : <form action={complete} className="mt-6 grid gap-3"><textarea className="min-h-28 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="note" placeholder="Launch confirmation: services live, client instructions delivered, support owner confirmed..." required /><button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950" type="submit">Complete client launch</button></form>}</section></main>;
}
