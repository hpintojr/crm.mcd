import Link from "next/link";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function pacific(value: Date | null) {
  return value ? value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" }) : "—";
}

export default async function ResolvedIntegrationHistoryPage() {
  await requireRole(ADMIN_ROLES);
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const errors = await db.integrationError.findMany({ where: { resolved: true, resolvedAt: { gte: cutoff } }, orderBy: { resolvedAt: "desc" }, take: 100 });
  const ids = errors.map((error) => error.id);
  const audits = ids.length ? await db.auditLog.findMany({ where: { actionType: "INTEGRATION_ERROR_RESOLVED", entityType: "IntegrationError", entityId: { in: ids } }, orderBy: { createdAt: "desc" }, take: 200 }) : [];
  const noteByErrorId = new Map<string, { note: string | null; at: Date }>();
  for (const audit of audits) {
    if (audit.entityId && !noteByErrorId.has(audit.entityId)) noteByErrorId.set(audit.entityId, { note: audit.reason, at: audit.createdAt });
  }

  return <main className="mx-auto min-h-screen max-w-6xl px-6 py-12"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">Resolved integration history</h1><p className="mt-2 max-w-3xl text-gray-400">Integration errors resolved during the last 14 days. This is a short-term operational view; the original error and resolution audit record remain retained after an item falls off this page.</p></div><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/integrations">Integration monitor</Link></div><section className="mt-6 rounded-xl border border-ink-700 bg-ink-900 px-5 py-4 text-sm text-gray-300">Marking an error resolved removes it from the active queue only. It does not replay the webhook, erase the failure, or alter the associated Lead, appointment, or client record.</section><section className="mt-8 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">{errors.length === 0 ? <p className="px-6 py-10 text-sm text-gray-400">No integration errors were resolved in the last 14 days.</p> : <div className="divide-y divide-ink-700">{errors.map((error) => { const resolution = noteByErrorId.get(error.id); return <article className="px-6 py-5" key={error.id}><div className="flex flex-wrap items-start justify-between gap-4"><div className="max-w-4xl"><p className="font-medium text-emerald-200">{error.source}</p><p className="mt-2 break-words text-sm text-gray-300">{error.message}</p><p className="mt-3 text-sm text-gray-400">Resolution note: {resolution?.note || "Recorded in audit history; no note text available."}</p><p className="mt-2 text-xs text-gray-500">Reference: {error.refId || "—"}</p></div><div className="text-right text-xs text-gray-500"><p>Resolved {pacific(error.resolvedAt)}</p><p className="mt-1">Note recorded {pacific(resolution?.at || null)}</p></div></div></article>; })}</div>}</section></main>;
}
