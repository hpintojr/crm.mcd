import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
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

  return <main className="mx-auto min-h-screen max-w-6xl px-6 py-12"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">Launch confirmations</h1><p className="mt-2 text-gray-400">Client accounts that exist but still need a documented launch confirmation before normal service workflow begins.</p></div><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/servicing">Client servicing</Link></div><section className="mt-8 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">{accounts.length === 0 ? <p className="px-6 py-10 text-sm text-gray-400">No launch confirmations are pending.</p> : <div className="divide-y divide-ink-700">{accounts.map((account) => <article className="flex flex-wrap items-center justify-between gap-4 px-6 py-5" key={account.id}><div><p className="font-medium text-white">{account.clientName}</p><p className="mt-1 text-sm text-gray-400">{account.packageCode} · {account.currentOnPayments ? "Current" : "Payment issue"}</p><p className="mt-1 text-xs text-gray-500">Created {pacific(account.createdAt)}</p></div><div className="flex gap-2"><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href={`/admin/servicing/${account.id}`}>Client detail</Link><Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={`/admin/servicing/${account.id}/launch`}>Confirm launch</Link></div></article>)}</div>}</section></main>;
}
