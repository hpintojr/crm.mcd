import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function date(value: Date | null) {
  return value ? value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" }) : "—";
}

function suggestedResolutionNote(source: string, message: string) {
  if (source === "ghl.appointments" && /starts_at|timezone/i.test(message)) {
    return "Resolved after normalizing the GHL appointment date and timezone values. Retested the appointment lifecycle successfully. Historical failed test event was not replayed.";
  }
  if (source === "ghl.lead-demo-handoff") {
    return "Resolved after reviewing the GHL demo-booked handoff configuration and completing a controlled retest. Historical failed event was not replayed.";
  }
  return "Resolved after investigation and a controlled retest. Historical event was not replayed.";
}

export default async function IntegrationMonitorPage() {
  const actor = await requireRole(ADMIN_ROLES);
  const [events, errors] = await Promise.all([
    db.webhookEvent.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    db.integrationError.findMany({ where: { resolved: false }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);

  async function resolveError(formData: FormData) {
    "use server";
    const reviewer = await requireRole(ADMIN_ROLES);
    const errorId = String(formData.get("errorId") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();
    if (errorId.length < 8) throw new Error("Invalid integration error.");
    if (note.length < 3) throw new Error("Provide a resolution note.");
    const error = await db.integrationError.findUnique({ where: { id: errorId } });
    if (!error) throw new Error("Integration error not found.");
    if (!error.resolved) {
      const now = new Date();
      await db.$transaction([
        db.integrationError.update({ where: { id: error.id }, data: { resolved: true, resolvedAt: now, resolvedById: reviewer.id } }),
        db.auditLog.create({ data: { actorUserId: reviewer.id, actorRole: reviewer.role, actionType: "INTEGRATION_ERROR_RESOLVED", entityType: "IntegrationError", entityId: error.id, reason: note } }),
      ]);
    }
    revalidatePath("/admin/integrations");
    revalidatePath("/admin/readiness");
  }

  return <main className="mx-auto min-h-screen max-w-7xl px-6 py-12"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">Integration monitor</h1><p className="mt-2 max-w-3xl text-gray-400">Inbound webhook and integration-failure visibility. Duplicate event IDs are idempotent and do not create new work. Resolve an error only after investigation; resolution does not replay the event.</p></div><div className="flex items-center gap-3"><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/operating-status">Operating status</Link><p className="text-sm text-gray-500">Admin session: {actor.email}</p></div></div><section className="mt-6 rounded-xl border border-ink-700 bg-ink-900 px-5 py-4 text-sm text-gray-300">Resolved errors leave this active queue immediately. Their resolution note is retained in the audit record; resolving an item does not replay its historical event.</section><section className="mt-6 grid gap-4 lg:grid-cols-2"><article className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><h2 className="font-semibold text-white">Appointment relay contract</h2><p className="mt-2 text-sm leading-6 text-gray-300">Send appointment workflow events to <code className="text-brand-200">/api/ghl/appointments</code>. Each event needs a unique event ID, approved location ID, appointment ID, valid ISO appointment time, and timezone. Include the GHL contact ID and the MiniCRM Lead ID when available.</p><p className="mt-3 text-xs text-gray-500">Accepted events: Booked, Confirmed, Rescheduled, Cancelled, No-show, and Completed. Booked events retain ownership; cancelled and no-show events create same-owner follow-up work.</p></article><article className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><h2 className="font-semibold text-white">Opportunity result relay contract</h2><p className="mt-2 text-sm leading-6 text-gray-300">Send deal-result events to <code className="text-brand-200">/api/ghl/opportunities</code>. Each event needs a unique event ID, approved location ID, GHL opportunity ID, and either the MiniCRM Lead ID or GHL contact ID for matching.</p><p className="mt-3 text-xs text-gray-500">Accepted events: Opportunity Won and Opportunity Lost. A late loss event cannot undo an existing Closed Won Lead; suppressed Leads are never changed by an opportunity event.</p></article></section><section className="mt-8 grid gap-6 xl:grid-cols-2"><article className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900"><div className="border-b border-ink-700 px-6 py-4"><h2 className="font-semibold text-white">Recent webhook events</h2></div>{events.length === 0 ? <p className="px-6 py-8 text-sm text-gray-400">No events received.</p> : <div className="divide-y divide-ink-700">{events.map((event) => <div className="px-6 py-4" key={event.id}><p className="font-medium text-white">{event.type} · {event.status}</p><p className="mt-1 text-xs text-gray-500">{event.ghlEventId} · {event.locationId || "No location"}</p><p className="mt-1 text-xs text-gray-500">Received {date(event.createdAt)} · Processed {date(event.processedAt)}</p></div>)}</div>}</article><article className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900"><div className="border-b border-ink-700 px-6 py-4"><h2 className="font-semibold text-white">Unresolved integration errors</h2></div>{errors.length === 0 ? <p className="px-6 py-8 text-sm text-gray-400">No unresolved integration errors.</p> : <div className="divide-y divide-ink-700">{errors.map((error) => <div className="px-6 py-4" key={error.id}><p className="font-medium text-red-200">{error.source}</p><p className="mt-2 break-words text-sm text-gray-300">{error.message}</p><p className="mt-2 text-xs text-gray-500">{error.refId || "No reference"} · {date(error.createdAt)}</p><form action={resolveError} className="mt-3 grid gap-2"><input name="errorId" type="hidden" value={error.id} /><textarea className="min-h-20 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="note" defaultValue={suggestedResolutionNote(error.source, error.message)} required /><button className="justify-self-start rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" type="submit">Mark resolved</button></form></div>)}</div>}</article></section></main>;
}
