import Link from "next/link";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function date(value: Date | null) {
  return value ? value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" }) : "—";
}

export default async function IntegrationMonitorPage() {
  await requireRole(ADMIN_ROLES);
  const [events, errors] = await Promise.all([
    db.webhookEvent.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    db.integrationError.findMany({ where: { resolved: false }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);

  return <main className="mx-auto min-h-screen max-w-7xl px-6 py-12"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">Integration monitor</h1><p className="mt-2 max-w-3xl text-gray-400">Read-only GHL webhook and integration-failure visibility. Duplicate event IDs are idempotent and do not create new work.</p></div><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/operating-status">Operating status</Link></div><section className="mt-8 grid gap-6 xl:grid-cols-2"><article className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900"><div className="border-b border-ink-700 px-6 py-4"><h2 className="font-semibold text-white">Recent webhook events</h2></div>{events.length === 0 ? <p className="px-6 py-8 text-sm text-gray-400">No events received.</p> : <div className="divide-y divide-ink-700">{events.map((event) => <div className="px-6 py-4" key={event.id}><p className="font-medium text-white">{event.type} · {event.status}</p><p className="mt-1 text-xs text-gray-500">{event.ghlEventId} · {event.locationId || "No location"}</p><p className="mt-1 text-xs text-gray-500">Received {date(event.createdAt)} · Processed {date(event.processedAt)}</p></div>)}</div>}</article><article className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900"><div className="border-b border-ink-700 px-6 py-4"><h2 className="font-semibold text-white">Unresolved integration errors</h2></div>{errors.length === 0 ? <p className="px-6 py-8 text-sm text-gray-400">No unresolved integration errors.</p> : <div className="divide-y divide-ink-700">{errors.map((error) => <div className="px-6 py-4" key={error.id}><p className="font-medium text-red-200">{error.source}</p><p className="mt-2 break-words text-sm text-gray-300">{error.message}</p><p className="mt-2 text-xs text-gray-500">{error.refId || "No reference"} · {date(error.createdAt)}</p></div>)}</div>}</article></section></main>;
}
