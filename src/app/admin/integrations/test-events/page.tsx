import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { controlledTestLeadWhere } from "@/lib/controlled-test-leads";
import {
  CONTROLLED_GHL_TEST_EVENT_APPLIED_ACTION,
  CONTROLLED_GHL_TEST_EVENT_PHASE,
  applyControlledGhlTestEvent,
  controlledAppointmentEventTypes,
  controlledOpportunityEventTypes,
  previewControlledGhlTestEventFromLead,
  type ControlledGhlTestFamily,
  type ControlledGhlTestEventType,
} from "@/lib/controlled-ghl-test-events";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ leadId?: string; family?: string; eventType?: string }> };

const applySchema = z.object({
  leadId: z.string().cuid(),
  family: z.enum(["appointment", "opportunity"]),
  eventType: z.string().trim().min(1),
  note: z.string().trim().max(1000).optional(),
});

function label(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase()) : "—";
}

function pacific(value: Date | null | undefined) {
  return value ? value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" }) : "—";
}

function normalizeFamily(value: string | undefined): ControlledGhlTestFamily {
  return value === "opportunity" ? "opportunity" : "appointment";
}

function eventOptions(family: ControlledGhlTestFamily) {
  return family === "appointment" ? controlledAppointmentEventTypes : controlledOpportunityEventTypes;
}

function normalizeEventType(family: ControlledGhlTestFamily, value: string | undefined): ControlledGhlTestEventType {
  const options = eventOptions(family);
  const normalized = value?.trim().toUpperCase();
  return (options as readonly string[]).includes(normalized || "") ? normalized as ControlledGhlTestEventType : options[0];
}

export default async function ControlledGhlTestEventsPage({ searchParams }: PageProps) {
  if (!features.leads) notFound();
  const actor = await requireRole(ADMIN_ROLES);
  const params = await searchParams;
  const family = normalizeFamily(params.family);
  const eventType = normalizeEventType(family, params.eventType);

  const [controlledLeads, recentHarnessAudits] = await Promise.all([
    db.lead.findMany({ where: controlledTestLeadWhere, orderBy: { createdAt: "desc" }, take: 100 }),
    db.auditLog.findMany({ where: { actionType: CONTROLLED_GHL_TEST_EVENT_APPLIED_ACTION }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const selectedLead = params.leadId ? controlledLeads.find((lead) => lead.id === params.leadId) ?? null : controlledLeads[0] ?? null;
  const preview = selectedLead ? previewControlledGhlTestEventFromLead(selectedLead, family, eventType) : null;

  async function applySimulation(formData: FormData) {
    "use server";
    if (!features.leads) throw new Error("Lead module is not enabled.");
    const applier = await requireRole(ADMIN_ROLES);
    const parsed = applySchema.safeParse({
      leadId: formData.get("leadId"),
      family: formData.get("family"),
      eventType: formData.get("eventType"),
      note: formData.get("note") || undefined,
    });
    if (!parsed.success) throw new Error("Invalid controlled GHL test simulation.");
    const eventType = normalizeEventType(parsed.data.family, parsed.data.eventType);
    await applyControlledGhlTestEvent({
      leadId: parsed.data.leadId,
      family: parsed.data.family,
      eventType,
      actorUserId: applier.id,
      actorRole: applier.role,
      note: parsed.data.note,
    });
    revalidatePath("/admin/integrations/test-events");
    revalidatePath("/admin/leads/acceptance-command-center");
    revalidatePath("/admin/integrations");
    revalidatePath("/admin/audit");
    revalidatePath("/portal/leads");
    revalidatePath(`/admin/leads/${parsed.data.leadId}`);
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Controlled GHL event harness</h1>
          <p className="mt-2 max-w-3xl text-gray-400">Preview and apply simulated appointment or opportunity events against controlled test Leads only. This harness does not call GHL, activate workflows, or accept live customer records.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-command-center">Command center</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/controlled-test-data">Controlled test data</Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/api/admin/leads/controlled-test-data">Test data JSON</Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/integrations">Integration monitor</Link>
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-amber-900 bg-amber-950/20 p-5">
        <h2 className="font-semibold text-amber-100">Harness boundary</h2>
        <p className="mt-2 text-sm leading-6 text-amber-100/80">Only Leads marked by PR #45 controlled test data can be selected. Each applied simulation writes <span className="font-mono">{CONTROLLED_GHL_TEST_EVENT_APPLIED_ACTION}</span> audit evidence with phase <span className="font-mono">{CONTROLLED_GHL_TEST_EVENT_PHASE}</span>. Preview is displayed before the apply button.</p>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-2xl border border-ink-700 bg-ink-900 p-6">
          <h2 className="font-semibold text-white">1. Choose test Lead and event</h2>
          {controlledLeads.length === 0 ? (
            <div className="mt-4 rounded-xl border border-ink-700 bg-ink-950 p-4 text-sm text-gray-300"><p>No controlled test Leads exist yet.</p><Link className="mt-3 inline-block text-brand-200" href="/admin/leads/controlled-test-data">Create controlled test data →</Link></div>
          ) : (
            <form className="mt-4 grid gap-3" method="get">
              <label className="text-sm text-gray-300">Controlled Lead<select className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="leadId" defaultValue={selectedLead?.id}>{controlledLeads.map((lead) => <option key={lead.id} value={lead.id}>{lead.company} · {label(lead.lifecycle)} · {lead.suppressed ? "Archived/suppressed" : "Active"}</option>)}</select></label>
              <label className="text-sm text-gray-300">Event family<select className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="family" defaultValue={family}><option value="appointment">Appointment lifecycle</option><option value="opportunity">Opportunity result</option></select></label>
              <label className="text-sm text-gray-300">Event type<select className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="eventType" defaultValue={eventType}>{eventOptions(family).map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label>
              <button className="justify-self-start rounded-lg border border-brand-500 px-4 py-2 text-sm text-brand-200" type="submit">Preview expected effects</button>
            </form>
          )}
        </article>

        <article className="rounded-2xl border border-ink-700 bg-ink-900 p-6">
          <h2 className="font-semibold text-white">2. Preview expected effects before submit</h2>
          {!selectedLead || !preview ? (
            <p className="mt-4 text-sm text-gray-400">Select a controlled test Lead to preview the event outcome.</p>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-ink-700 bg-ink-950 p-4">
                <p className="font-medium text-white">{selectedLead.company}</p>
                <p className="mt-1 text-sm text-gray-400">Current state: {label(selectedLead.pool)} / {label(selectedLead.lifecycle)} · Owner: {selectedLead.ownerAgentId || "Unowned"}</p>
                <p className="mt-1 text-xs text-gray-500">Two-way contact: {pacific(selectedLead.twoWayContactAt)} · Suppressed/DNC: {selectedLead.suppressed || selectedLead.dnc ? "Yes" : "No"}</p>
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-ink-700 p-3"><dt className="text-xs text-gray-500">Expected lifecycle</dt><dd className="mt-1 text-sm font-medium text-white">{label(preview.expected.lifecycle)}</dd></div>
                <div className="rounded-xl border border-ink-700 p-3"><dt className="text-xs text-gray-500">Two-way contact</dt><dd className="mt-1 text-sm font-medium text-white">{preview.expected.twoWayContactRecorded ? "Will record" : "No new timestamp expected"}</dd></div>
                <div className="rounded-xl border border-ink-700 p-3"><dt className="text-xs text-gray-500">Callbacks</dt><dd className="mt-1 text-sm font-medium text-white">{preview.expected.callbacksCancelled ? "Will cancel scheduled callbacks" : preview.expected.callbackCreatedOrExpedited ? "May create/expedite one callback" : "No callback change expected"}</dd></div>
                <div className="rounded-xl border border-ink-700 p-3"><dt className="text-xs text-gray-500">Suppression / Closed Won guard</dt><dd className="mt-1 text-sm font-medium text-white">{preview.ignoredBecauseSuppressedOrDnc ? "Ignored because suppressed/DNC" : preview.preservedClosedWon ? "Closed Won preserved" : "No guard block expected"}</dd></div>
              </dl>
              <form action={applySimulation} className="rounded-xl border border-brand-500/50 bg-brand-500/10 p-4">
                <input name="leadId" type="hidden" value={selectedLead.id} />
                <input name="family" type="hidden" value={family} />
                <input name="eventType" type="hidden" value={eventType} />
                <label className="text-sm text-gray-200">Audit note<textarea className="mt-1 min-h-20 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="note" defaultValue={`Controlled ${eventType} simulation after preview.`} /></label>
                <button className="mt-3 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950" type="submit">Apply controlled simulation</button>
                <p className="mt-2 text-xs text-gray-500">Applies to controlled Lead only. No live GHL call is made.</p>
              </form>
            </div>
          )}
        </article>
      </section>

      <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <h2 className="font-semibold text-white">Recent harness evidence</h2>
        {recentHarnessAudits.length === 0 ? <p className="mt-3 text-sm text-gray-400">No controlled GHL simulations have been applied yet.</p> : <div className="mt-4 divide-y divide-ink-700">{recentHarnessAudits.map((audit) => <div className="py-3" key={audit.id}><p className="text-sm font-medium text-white">{audit.reason || audit.actionType}</p><p className="mt-1 text-xs text-gray-500">{audit.entityId} · {pacific(audit.createdAt)}</p></div>)}</div>}
      </section>
    </main>
  );
}
