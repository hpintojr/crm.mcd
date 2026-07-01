import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";

const actionSchema = z.object({
  leadId: z.string().cuid(),
  action: z.enum(["approve", "suppress", "disqualify"]),
  pool: z.enum(["COLD", "OPEN", "HOT", "REFERRAL", "HOUSE", "NURTURE"]).optional(),
  reason: z.string().trim().max(2000).optional(),
});

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

export default async function AdminLeadsPage() {
  if (!features.leads) notFound();
  const user = await requireRole(ADMIN_ROLES);
  const [reviewQueue, suppressed] = await Promise.all([
    db.lead.findMany({ where: { lifecycle: { in: ["RAW", "PENDING_REVIEW"] }, suppressed: false }, orderBy: [{ score: "desc" }, { createdAt: "asc" }], take: 100 }),
    db.lead.count({ where: { suppressed: true } }),
  ]);

  async function review(formData: FormData) {
    "use server";
    const parsed = actionSchema.safeParse({
      leadId: formData.get("leadId"),
      action: formData.get("action"),
      pool: formData.get("pool") || undefined,
      reason: formData.get("reason") || undefined,
    });
    if (!parsed.success) throw new Error("Invalid lead review action.");
    const actor = await requireRole(ADMIN_ROLES);
    const lead = await db.lead.findUnique({ where: { id: parsed.data.leadId } });
    if (!lead) throw new Error("Lead not found.");
    const now = new Date();

    if (parsed.data.action === "approve") {
      const pool = parsed.data.pool ?? "COLD";
      await db.$transaction([
        db.lead.update({ where: { id: lead.id }, data: { lifecycle: "AVAILABLE", pool, lastActionAt: now } }),
        db.leadActivity.create({ data: { leadId: lead.id, type: "LEAD_CREATED", metadata: { approvedPool: pool } } }),
        db.auditLog.create({ data: { actorUserId: actor.id, actorRole: actor.role, actionType: "LEAD_APPROVED_TO_POOL", entityType: "Lead", entityId: lead.id, metadata: { pool } } }),
      ]);
    }

    if (parsed.data.action === "disqualify") {
      const reason = parsed.data.reason?.trim();
      if (!reason || reason.length < 3) throw new Error("Provide a review reason.");
      await db.$transaction([
        db.lead.update({ where: { id: lead.id }, data: { lifecycle: "DISQUALIFIED", lastActionAt: now } }),
        db.leadActivity.create({ data: { leadId: lead.id, type: "DISPOSITION_SET", disposition: "OUT_OF_BUSINESS", metadata: { reason } } }),
        db.auditLog.create({ data: { actorUserId: actor.id, actorRole: actor.role, actionType: "LEAD_DISQUALIFIED", entityType: "Lead", entityId: lead.id, reason } }),
      ]);
    }

    if (parsed.data.action === "suppress") {
      const reason = parsed.data.reason?.trim();
      if (!reason || reason.length < 3) throw new Error("Provide a suppression reason.");
      const identifier = lead.normalizedPhone ?? lead.businessPhone ?? lead.email ?? lead.id;
      await db.$transaction([
        db.lead.update({ where: { id: lead.id }, data: { lifecycle: "SUPPRESSED", suppressed: true, ownerAgentId: null, lastActionAt: now } }),
        db.leadSuppression.create({ data: { leadId: lead.id, identifier, type: "COMPLIANCE_HOLD", reason, createdById: actor.id } }),
        db.leadActivity.create({ data: { leadId: lead.id, type: "DNC_REQUESTED", metadata: { type: "COMPLIANCE_HOLD", reason } } }),
        db.auditLog.create({ data: { actorUserId: actor.id, actorRole: actor.role, actionType: "LEAD_SUPPRESSED", entityType: "Lead", entityId: lead.id, reason } }),
      ]);
    }

    revalidatePath("/admin/leads");
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Lead review</h1>
      <p className="mt-2 text-gray-400">Validate every prospect before pool assignment. Suppressed records are excluded from agent work and campaigns.</p>
      <p className="mt-4 text-sm text-gray-500">Suppressed records: {suppressed} · Signed in as {user.email}</p>

      <section className="mt-10 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        <div className="border-b border-ink-700 px-6 py-4"><h2 className="font-semibold text-white">Validation queue</h2></div>
        {reviewQueue.length === 0 ? <p className="px-6 py-10 text-sm text-gray-400">No new records are awaiting validation.</p> : (
          <div className="divide-y divide-ink-700">
            {reviewQueue.map((lead) => (
              <article className="px-6 py-5" key={lead.id}>
                <div className="flex flex-col justify-between gap-5 xl:flex-row">
                  <div>
                    <p className="font-medium text-white">{lead.company}</p>
                    <p className="mt-1 text-sm text-gray-400">{lead.businessPhone} · {lead.industry || "Industry pending"}</p>
                    <p className="mt-1 text-xs text-gray-500">Source: {lead.source || "Not recorded"} · Score {lead.score} · {label(lead.lifecycle)}</p>
                  </div>
                  <div className="grid min-w-80 gap-2">
                    <form action={review} className="flex gap-2"><input name="leadId" type="hidden" value={lead.id} /><input name="action" type="hidden" value="approve" /><select className="min-w-0 flex-1 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" defaultValue="COLD" name="pool"><option value="COLD">Cold</option><option value="OPEN">Open</option><option value="HOT">Hot</option><option value="REFERRAL">Referral</option><option value="NURTURE">Nurture</option><option value="HOUSE">House</option></select><button className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-ink-950" type="submit">Approve</button></form>
                    <form action={review} className="grid grid-cols-[1fr_auto] gap-2"><input name="leadId" type="hidden" value={lead.id} /><input name="action" type="hidden" value="disqualify" /><input className="min-w-0 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="reason" placeholder="Disqualification reason" required /><button className="rounded-lg border border-amber-700 px-3 py-2 text-sm text-amber-300" type="submit">Disqualify</button></form>
                    <form action={review} className="grid grid-cols-[1fr_auto] gap-2"><input name="leadId" type="hidden" value={lead.id} /><input name="action" type="hidden" value="suppress" /><input className="min-w-0 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="reason" placeholder="Compliance reason" required /><button className="rounded-lg border border-red-800 px-3 py-2 text-sm text-red-300" type="submit">Suppress</button></form>
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
