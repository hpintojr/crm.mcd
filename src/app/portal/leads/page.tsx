import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { claimAvailableLead } from "@/lib/claims";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { logColdLeadDisposition, logLeadInteraction, suppressLeadForDnc } from "@/lib/lead-workspace";
import { ColdLeadDialButton } from "@/components/cold-lead-dial-button";
import { LeadResearchFields } from "@/components/lead-research-fields";
import { PortalFeaturePage } from "@/components/portal-feature-page";
import { getPortalContext } from "@/lib/portal-context";

export const dynamic = "force-dynamic";

type LeadsPageProps = { searchParams: Promise<{ selected?: string; selectedCold?: string }> };

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function pacific(value: Date) {
  return value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" });
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const { agent } = await getPortalContext();
  const params = await searchParams;

  if (!features.leads) {
    return (
      <PortalFeaturePage eyebrow="Pipeline" title="Leads" description="Assigned leads and future Open Pool opportunities will be managed here.">
        <section className="portal-card max-w-3xl">
          <h2 className="portal-heading text-lg font-semibold">Lead workspace is staged</h2>
          <p className="portal-copy mt-3 text-sm">The lead module is intentionally held until source tracking, suppression controls, assignment rules, controlled migrations, and operational testing are complete.</p>
          <div className="portal-callout mt-5 text-sm"><span className={`font-medium ${agent?.canClaimLeads ? "portal-status-good" : "portal-status-pending"}`}>{agent?.canClaimLeads ? "Certification recorded" : "Certification required"}</span><span className="portal-muted"> · Lead records will appear here when the rollout is enabled.</span></div>
        </section>
      </PortalFeaturePage>
    );
  }

  const [coldLeads, mine] = await Promise.all([
    db.lead.findMany({
      where: { ownerAgentId: null, lifecycle: "AVAILABLE", pool: "COLD", dnc: false, suppressed: false },
      orderBy: [{ score: "desc" }, { createdAt: "asc" }],
      take: 100,
    }),
    agent ? db.lead.findMany({ where: { ownerAgentId: agent.id, dnc: false, suppressed: false }, orderBy: [{ nextActionAt: "asc" }, { lastActionAt: "desc" }], take: 100 }) : Promise.resolve([]),
  ]);

  const selectedColdLead = params.selectedCold
    ? await db.lead.findFirst({
      where: {
        id: params.selectedCold,
        ownerAgentId: null,
        pool: { in: ["COLD", "HOT", "NURTURE"] },
        lifecycle: { in: ["AVAILABLE", "CONTACTED", "NURTURING", "DEMO_BOOKED"] },
        dnc: false,
        suppressed: false,
      },
    })
    : null;
  const selectedColdActivities = selectedColdLead ? await db.leadActivity.findMany({ where: { leadId: selectedColdLead.id }, orderBy: { occurredAt: "desc" }, take: 12 }) : [];
  const selectedColdNotes = selectedColdLead ? await db.leadNote.findMany({ where: { leadId: selectedColdLead.id }, orderBy: { createdAt: "desc" }, take: 12 }) : [];
  const selectedColdCallbacks = selectedColdLead ? await db.leadCallback.findMany({ where: { leadId: selectedColdLead.id }, orderBy: { dueAt: "desc" }, take: 12 }) : [];
  const selectedColdClaimEligible = selectedColdLead ? ["CONTACTED", "NURTURING", "DEMO_BOOKED"].includes(selectedColdLead.lifecycle) && ["HOT", "NURTURE"].includes(selectedColdLead.pool) && Boolean(selectedColdLead.twoWayContactAt) : false;

  const selectedLead = agent && params.selected
    ? await db.lead.findFirst({ where: { id: params.selected, ownerAgentId: agent.id, dnc: false, suppressed: false } })
    : null;
  const activities = selectedLead ? await db.leadActivity.findMany({ where: { leadId: selectedLead.id }, orderBy: { occurredAt: "desc" }, take: 12 }) : [];
  const notes = selectedLead ? await db.leadNote.findMany({ where: { leadId: selectedLead.id }, orderBy: { createdAt: "desc" }, take: 12 }) : [];
  const callbacks = selectedLead ? await db.leadCallback.findMany({ where: { leadId: selectedLead.id }, orderBy: { dueAt: "desc" }, take: 12 }) : [];

  async function claim(formData: FormData) {
    "use server";
    const actor = await requireRole(["AGENT", ...ADMIN_ROLES]);
    const leadId = String(formData.get("leadId") ?? "");
    if (!leadId) throw new Error("Lead is required.");
    await claimAvailableLead({ userId: actor.id, role: actor.role }, leadId);
    revalidatePath("/portal/leads");
  }

  async function recordColdDisposition(formData: FormData) {
    "use server";
    await logColdLeadDisposition({
      leadId: String(formData.get("leadId") ?? ""),
      disposition: String(formData.get("disposition") ?? ""),
      note: String(formData.get("note") ?? "") || undefined,
      callbackAtPacific: String(formData.get("callbackAtPacific") ?? "") || undefined,
    });
    revalidatePath("/portal/leads");
  }

  async function recordInteraction(formData: FormData) {
    "use server";
    await logLeadInteraction({
      leadId: String(formData.get("leadId") ?? ""),
      disposition: String(formData.get("disposition") ?? ""),
      note: String(formData.get("note") ?? "") || undefined,
      callbackAtPacific: String(formData.get("callbackAtPacific") ?? "") || undefined,
    });
    revalidatePath("/portal/leads");
  }

  async function applyDnc(formData: FormData) {
    "use server";
    await suppressLeadForDnc({
      leadId: String(formData.get("leadId") ?? ""),
      reason: String(formData.get("reason") ?? "") || undefined,
    });
    revalidatePath("/portal/leads");
  }

  return (
    <PortalFeaturePage eyebrow="Pipeline" title="Leads" description="Work Cold Leads first. Activity does not create ownership; only verified two-way contact unlocks claiming.">
      <section className="grid gap-6 xl:grid-cols-2">
        <section className="portal-card p-0">
          <div className="border-b px-6 py-4 portal-border"><h2 className="portal-heading font-semibold">Cold Lead workspace</h2><p className="portal-copy mt-1 text-sm">Call attempts create activity only. No soft lock, no ownership, no claim before two-way contact.</p></div>
          {coldLeads.length === 0 ? <p className="portal-copy px-6 py-10 text-sm">No Cold Leads are currently available.</p> : <div>{coldLeads.map((lead) => <Link className={`block border-b px-6 py-5 transition hover:bg-black/5 portal-border ${selectedColdLead?.id === lead.id ? "bg-black/5" : ""}`} href={`/portal/leads?selectedCold=${lead.id}`} key={lead.id}><p className="portal-heading font-medium">{lead.company}</p><p className="portal-copy mt-1 text-sm">{lead.industry || "Industry pending"} · {[lead.city, lead.state].filter(Boolean).join(", ") || "Location pending"}</p><p className="portal-copy mt-1 text-xs">{label(lead.pool)} · {label(lead.lifecycle)} · Score {lead.score}</p></Link>)}</div>}
        </section>
        <section className="portal-card p-0">
          <div className="border-b px-6 py-4 portal-border"><h2 className="portal-heading font-semibold">My active records</h2><p className="portal-copy mt-1 text-sm">Callbacks and next actions are shown first.</p></div>
          {mine.length === 0 ? <p className="portal-copy px-6 py-10 text-sm">No records are assigned to you.</p> : <div>{mine.map((lead) => <Link className={`block border-b px-6 py-5 transition hover:bg-black/5 portal-border ${selectedLead?.id === lead.id ? "bg-black/5" : ""}`} href={`/portal/leads?selected=${lead.id}`} key={lead.id}><p className="portal-heading font-medium">{lead.company}</p><p className="portal-copy mt-1 text-sm">{lead.businessPhone} · {label(lead.lifecycle)}</p><p className="portal-copy mt-1 text-xs">Next action: {lead.nextActionAt ? pacific(lead.nextActionAt) : "Not scheduled"}</p></Link>)}</div>}
        </section>
      </section>

      {selectedColdLead && <section className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="portal-card">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-xs font-medium uppercase tracking-wide text-brand-400">Cold Lead activity</p><h2 className="portal-heading mt-1 text-2xl font-semibold">{selectedColdLead.company}</h2><p className="portal-copy mt-1 text-sm">{selectedColdLead.businessPhone}{selectedColdLead.email ? ` · ${selectedColdLead.email}` : ""}</p></div><span className="rounded-full border px-3 py-1 text-xs font-semibold portal-border">{label(selectedColdLead.pool)} · {label(selectedColdLead.lifecycle)}</span></div>
          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><div><p className="portal-muted">Source</p><p className="portal-heading mt-1">{selectedColdLead.originalSource ? label(selectedColdLead.originalSource) : selectedColdLead.source || "Not recorded"}</p></div><div><p className="portal-muted">Location</p><p className="portal-heading mt-1">{[selectedColdLead.city, selectedColdLead.state].filter(Boolean).join(", ") || "Not recorded"}</p></div><div><p className="portal-muted">Website</p><p className="portal-heading mt-1 break-all">{selectedColdLead.website || "Not recorded"}</p></div><div><p className="portal-muted">Two-way contact</p><p className="portal-heading mt-1">{selectedColdLead.twoWayContactAt ? pacific(selectedColdLead.twoWayContactAt) : "Not yet verified"}</p></div></div>
          <div className="mt-6"><LeadResearchFields leadId={selectedColdLead.id} /></div>
          <div className="mt-7 grid gap-3 border-t pt-6 portal-border sm:grid-cols-2">
            <ColdLeadDialButton leadId={selectedColdLead.id} phone={selectedColdLead.normalizedPhone || selectedColdLead.businessPhone} />
          </div>
          <form action={recordColdDisposition} className="mt-6 space-y-4 rounded-xl border p-4 portal-border"><input name="leadId" type="hidden" value={selectedColdLead.id} /><div><label className="portal-heading text-sm font-medium" htmlFor="coldDisposition">Disposition after call</label><select className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm portal-border" defaultValue="NO_ANSWER" id="coldDisposition" name="disposition"><option value="NO_ANSWER">No answer</option><option value="VOICEMAIL">Voicemail</option><option value="CALLBACK_REQUESTED">Callback requested</option><option value="QUALIFIED">Qualified / spoke with decision maker</option><option value="FOLLOW_UP">Follow up / interested</option><option value="NOT_INTERESTED">Not interested</option><option value="WRONG_NUMBER">Wrong number</option><option value="OUT_OF_BUSINESS">Out of business</option></select><p className="portal-copy mt-1 text-xs">Only callback requested, qualified, or follow-up/interested outcomes unlock claiming.</p></div><div><label className="portal-heading text-sm font-medium" htmlFor="coldNote">Call notes</label><textarea className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm portal-border" id="coldNote" name="note" placeholder="Document the meaningful result. No-answer and voicemail do not reserve this lead." rows={4} /></div><div><label className="portal-heading text-sm font-medium" htmlFor="coldCallbackAtPacific">Follow-up time, Pacific</label><input className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm portal-border" id="coldCallbackAtPacific" name="callbackAtPacific" type="datetime-local" /><p className="portal-copy mt-1 text-xs">Callback before claim creates a task only; it does not reserve ownership.</p></div><button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-brand-400" type="submit">Save disposition</button></form>
          {selectedColdClaimEligible && <form action={claim} className="mt-4 rounded-xl border border-brand-500/50 bg-brand-500/10 p-4"><input name="leadId" type="hidden" value={selectedColdLead.id} /><h3 className="portal-heading text-sm font-semibold">Claim unlocked</h3><p className="portal-copy mt-1 text-xs">Two-way contact is verified. Claiming starts the 45-day responsibility timer.</p><button className="mt-3 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-brand-400" type="submit">Claim this lead</button></form>}
          <form action={applyDnc} className="mt-4 rounded-xl border border-red-800/70 bg-red-950/20 p-4"><input name="leadId" type="hidden" value={selectedColdLead.id} /><label className="text-sm font-medium text-red-100" htmlFor="coldReason">Do not contact</label><textarea className="mt-2 w-full rounded-lg border border-red-800/70 bg-transparent px-3 py-2 text-sm text-red-50" id="coldReason" name="reason" placeholder="Optional opt-out wording or context." rows={2} /><p className="mt-2 text-xs text-red-200">This immediately suppresses the record across lead workflows and cancels scheduled callbacks.</p><button className="mt-3 rounded-lg border border-red-500 px-4 py-2 text-sm font-medium text-red-100 hover:bg-red-950/70" type="submit">Apply DNC and suppress</button></form>
        </section>
        <aside className="space-y-6">
          <section className="portal-card"><h2 className="portal-heading text-lg font-semibold">Cold activity</h2>{selectedColdActivities.length === 0 ? <p className="portal-copy mt-3 text-sm">No activity logged yet.</p> : <div className="mt-4 space-y-3">{selectedColdActivities.map((activity) => <div className="border-b pb-3 last:border-b-0 portal-border" key={activity.id}><p className="portal-heading text-sm font-medium">{label(activity.type)}{activity.disposition ? ` · ${label(activity.disposition)}` : ""}</p><p className="portal-copy mt-1 text-xs">{pacific(activity.occurredAt)}</p></div>)}</div>}</section>
          <section className="portal-card"><h2 className="portal-heading text-lg font-semibold">Notes</h2>{selectedColdNotes.length === 0 ? <p className="portal-copy mt-3 text-sm">No notes logged yet.</p> : <div className="mt-4 space-y-3">{selectedColdNotes.map((note) => <div className="border-b pb-3 last:border-b-0 portal-border" key={note.id}><p className="portal-copy text-sm whitespace-pre-wrap">{note.body}</p><p className="portal-copy mt-1 text-xs">{pacific(note.createdAt)}</p></div>)}</div>}</section>
          <section className="portal-card"><h2 className="portal-heading text-lg font-semibold">Follow-up history</h2>{selectedColdCallbacks.length === 0 ? <p className="portal-copy mt-3 text-sm">No callbacks recorded yet.</p> : <div className="mt-4 space-y-3">{selectedColdCallbacks.map((callback) => <div className="border-b pb-3 last:border-b-0 portal-border" key={callback.id}><p className="portal-heading text-sm font-medium">{label(callback.status)}</p><p className="portal-copy mt-1 text-xs">Due {pacific(callback.dueAt)}</p></div>)}</div>}</section>
        </aside>
      </section>}

      {selectedLead && <section className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="portal-card">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-xs font-medium uppercase tracking-wide text-brand-400">Selected record</p><h2 className="portal-heading mt-1 text-2xl font-semibold">{selectedLead.company}</h2><p className="portal-copy mt-1 text-sm">{selectedLead.businessPhone}{selectedLead.email ? ` · ${selectedLead.email}` : ""}</p></div><span className="rounded-full border px-3 py-1 text-xs font-semibold portal-border">{label(selectedLead.lifecycle)}</span></div>
          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><div><p className="portal-muted">Source</p><p className="portal-heading mt-1">{selectedLead.originalSource ? label(selectedLead.originalSource) : selectedLead.source || "Not recorded"}</p></div><div><p className="portal-muted">Location</p><p className="portal-heading mt-1">{[selectedLead.city, selectedLead.state].filter(Boolean).join(", ") || "Not recorded"}</p></div><div><p className="portal-muted">Website</p><p className="portal-heading mt-1 break-all">{selectedLead.website || "Not recorded"}</p></div><div><p className="portal-muted">Next action</p><p className="portal-heading mt-1">{selectedLead.nextActionAt ? pacific(selectedLead.nextActionAt) : "Not scheduled"}</p></div></div>
          <div className="mt-6"><LeadResearchFields leadId={selectedLead.id} /></div>
          <form action={recordInteraction} className="mt-7 space-y-4 border-t pt-6 portal-border"><input name="leadId" type="hidden" value={selectedLead.id} /><div><label className="portal-heading text-sm font-medium" htmlFor="disposition">Outcome</label><select className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm portal-border" defaultValue="FOLLOW_UP" id="disposition" name="disposition"><option value="NO_ANSWER">No answer</option><option value="VOICEMAIL">Voicemail</option><option value="CALLBACK_REQUESTED">Callback requested</option><option value="QUALIFIED">Qualified</option><option value="NOT_INTERESTED">Not interested</option><option value="WRONG_NUMBER">Wrong number</option><option value="OUT_OF_BUSINESS">Out of business</option><option value="DEMO_BOOKED">Demo booked</option><option value="FOLLOW_UP">Follow up</option></select></div><div><label className="portal-heading text-sm font-medium" htmlFor="note">Interaction note</label><textarea className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm portal-border" id="note" name="note" placeholder="Document the meaningful result and agreed next step." rows={4} /></div><div><label className="portal-heading text-sm font-medium" htmlFor="callbackAtPacific">Follow-up time, Pacific</label><input className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm portal-border" id="callbackAtPacific" name="callbackAtPacific" type="datetime-local" /><p className="portal-copy mt-1 text-xs">Leave blank when no follow-up is needed. A new follow-up closes prior scheduled callbacks.</p></div><button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-brand-400" type="submit">Save outcome</button></form>
          <form action={applyDnc} className="mt-4 rounded-xl border border-red-800/70 bg-red-950/20 p-4"><input name="leadId" type="hidden" value={selectedLead.id} /><label className="text-sm font-medium text-red-100" htmlFor="reason">Do not contact</label><textarea className="mt-2 w-full rounded-lg border border-red-800/70 bg-transparent px-3 py-2 text-sm text-red-50" id="reason" name="reason" placeholder="Optional opt-out wording or context." rows={2} /><p className="mt-2 text-xs text-red-200">This immediately suppresses the record across lead workflows and cancels scheduled callbacks.</p><button className="mt-3 rounded-lg border border-red-500 px-4 py-2 text-sm font-medium text-red-100 hover:bg-red-950/70" type="submit">Apply DNC and suppress</button></form>
        </section>
        <aside className="space-y-6">
          <section className="portal-card"><h2 className="portal-heading text-lg font-semibold">Recent activity</h2>{activities.length === 0 ? <p className="portal-copy mt-3 text-sm">No activity logged yet.</p> : <div className="mt-4 space-y-3">{activities.map((activity) => <div className="border-b pb-3 last:border-b-0 portal-border" key={activity.id}><p className="portal-heading text-sm font-medium">{label(activity.type)}{activity.disposition ? ` · ${label(activity.disposition)}` : ""}</p><p className="portal-copy mt-1 text-xs">{pacific(activity.occurredAt)}</p></div>)}</div>}</section>
          <section className="portal-card"><h2 className="portal-heading text-lg font-semibold">Notes</h2>{notes.length === 0 ? <p className="portal-copy mt-3 text-sm">No notes logged yet.</p> : <div className="mt-4 space-y-3">{notes.map((note) => <div className="border-b pb-3 last:border-b-0 portal-border" key={note.id}><p className="portal-copy text-sm whitespace-pre-wrap">{note.body}</p><p className="portal-copy mt-1 text-xs">{pacific(note.createdAt)}</p></div>)}</div>}</section>
          <section className="portal-card"><h2 className="portal-heading text-lg font-semibold">Follow-up history</h2>{callbacks.length === 0 ? <p className="portal-copy mt-3 text-sm">No callbacks recorded yet.</p> : <div className="mt-4 space-y-3">{callbacks.map((callback) => <div className="border-b pb-3 last:border-b-0 portal-border" key={callback.id}><p className="portal-heading text-sm font-medium">{label(callback.status)}</p><p className="portal-copy mt-1 text-xs">Due {pacific(callback.dueAt)}</p></div>)}</div>}</section>
        </aside>
      </section>}
    </PortalFeaturePage>
  );
}
