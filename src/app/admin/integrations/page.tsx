import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function date(value: Date | null) {
  return value ? value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" }) : "—";
}

function suggestedResolutionNote(source: string, message: string) {
  if (source === "ghl.appointments" && /starts_at|timezone/i.test(message)) return "Resolved after normalizing the GHL appointment date and timezone values. Retested the appointment lifecycle successfully. Historical failed test event was not replayed.";
  if (source === "ghl.lead-demo-handoff") return "Resolved after reviewing the GHL demo-booked handoff configuration and completing a controlled retest. Historical failed event was not replayed.";
  if (source === "ghl.replies") return "Resolved after reviewing the inbound reply payload, matching identifier, and Lead safety state. Retested with a controlled reply event; historical failed event was not replayed.";
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

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Integration monitor</h1>
          <p className="mt-2 max-w-3xl text-gray-400">Inbound webhook and integration-failure visibility. Duplicate event IDs are idempotent and do not create new work. Resolve an error only after investigation; resolution does not replay the event.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-command-center">Lead command center</Link><Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-runbook">Lead acceptance runbook</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/integrations/test-events">Controlled GHL harness</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/integrations/replies">Reply relay setup</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/integrations/opportunities">Opportunity relay setup</Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/integrations/resolved">Resolved history</Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/operating-status">Operating status</Link>
          <p className="text-sm text-gray-500">Admin session: {actor.email}</p>
        </div>
      </div>

      <section className="mt-6 rounded-xl border border-ink-700 bg-ink-900 px-5 py-4 text-sm text-gray-300">Resolved errors leave this active queue immediately. Their resolution note is retained in the audit record; resolving an item does not replay its historical event.</section>

      <section className="mt-6 grid gap-4 lg:grid-cols-4">
        <article className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
          <h2 className="font-semibold text-white">Controlled event harness</h2>
          <p className="mt-2 text-sm leading-6 text-gray-300">Preview and apply appointment or opportunity event simulations against controlled test Leads only. No live GHL call or workflow activation occurs.</p>
          <Link className="mt-4 inline-block text-sm font-medium text-brand-200" href="/admin/integrations/test-events">Open harness →</Link>
        </article>
        <article className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
          <h2 className="font-semibold text-white">Lead acceptance command center</h2>
          <p className="mt-2 text-sm leading-6 text-gray-300">Use the command center to review acceptance progress before activating live GHL workflow behavior or expanding normal Lead Flow use.</p>
          <Link className="mt-4 inline-block text-sm font-medium text-brand-200" href="/admin/leads/acceptance-command-center">Open command center →</Link>
        </article>
        <article className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
          <h2 className="font-semibold text-white">Opportunity result relay contract</h2>
          <p className="mt-2 text-sm leading-6 text-gray-300">Send deal-result events to <code className="text-brand-200">/api/ghl/opportunities</code>. Each event needs a unique event ID, approved location ID, GHL opportunity ID, and either the MiniCRM Lead ID or GHL contact ID for matching.</p>
          <p className="mt-3 text-xs text-gray-500">Accepted events: Opportunity Won and Opportunity Lost. A late loss event cannot undo an existing Closed Won Lead; suppressed Leads are never changed by an opportunity event.</p>
          <Link className="mt-4 inline-block text-sm font-medium text-brand-200" href="/admin/integrations/opportunities">Open opportunity setup →</Link>
        </article>
        <article className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
          <h2 className="font-semibold text-white">Inbound reply relay contract</h2>
          <p className="mt-2 text-sm leading-6 text-gray-300">Send verified Email or SMS replies to <code className="text-brand-200">/api/ghl/replies</code>. Each event needs a unique event ID, approved location ID, channel, message, and a MiniCRM Lead ID, GHL contact ID, sender email, or sender phone for matching.</p>
          <p className="mt-3 text-xs text-gray-500">Owned replies create or expedite one callback. Unassigned replies enter management triage. DNC and suppressed Leads are never changed.</p>
          <Link className="mt-4 inline-block text-sm font-medium text-brand-200" href="/admin/integrations/replies">Open reply setup →</Link>
        </article>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        <article className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
          <div className="border-b border-ink-700 px-6 py-4"><h2 className="font-semibold text-white">Recent webhook events</h2></div>
          {events.length === 0 ? <p className="px-6 py-8 text-sm text-gray-400">No events received.</p> : <div className="divide-y divide-ink-700">{events.map((event) => <div className="px-6 py-4" key={event.id}><p className="font-medium text-white">{event.type} · {event.status}</p><p className="mt-1 text-xs text-gray-500">{event.ghlEventId} · {event.locationId || "No location"}</p><p className="mt-1 text-xs text-gray-500">Received {date(event.createdAt)} · Processed {date(event.processedAt)}</p></div>)}</div>}
        </article>
        <article className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
          <div className="border-b border-ink-700 px-6 py-4"><h2 className="font-semibold text-white">Unresolved integration errors</h2></div>
          {errors.length === 0 ? <p className="px-6 py-8 text-sm text-gray-400">No unresolved integration errors.</p> : <div className="divide-y divide-ink-700">{errors.map((error) => <div className="px-6 py-4" key={error.id}><p className="font-medium text-red-200">{error.source}</p><p className="mt-2 break-words text-sm text-gray-300">{error.message}</p><p className="mt-2 text-xs text-gray-500">{error.refId || "No reference"} · {date(error.createdAt)}</p><form action={resolveError} className="mt-3 grid gap-2"><input name="errorId" type="hidden" value={error.id} /><textarea className="min-h-20 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="note" defaultValue={suggestedResolutionNote(error.source, error.message)} required /><button className="justify-self-start rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" type="submit">Mark resolved</button></form></div>)}</div>}
        </article>
      </section>
    </main>
  );
}
