import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requireRole(ADMIN_ROLES);
  const entries = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 250 });
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Audit history</h1>
      <p className="mt-2 text-gray-400">Recent sensitive and operational actions recorded by the Mini CRM.</p>
      <section className="mt-10 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        {entries.length === 0 ? <p className="px-6 py-10 text-sm text-gray-400">No audit records yet.</p> : (
          <div className="divide-y divide-ink-700">
            {entries.map((entry) => (
              <article className="px-6 py-4" key={entry.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-white">{entry.actionType}</p>
                    <p className="mt-1 text-sm text-gray-400">{entry.entityType}{entry.entityId ? ` · ${entry.entityId}` : ""}</p>
                    {entry.reason && <p className="mt-2 text-sm text-gray-300">Reason: {entry.reason}</p>}
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <p>{entry.actorRole || "System"}</p>
                    <p className="mt-1">{entry.createdAt.toLocaleString()}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
