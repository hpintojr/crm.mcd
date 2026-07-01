import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";

const formSchema = z.object({
  agentId: z.string().cuid(),
  productScore: z.coerce.number().int().min(0).max(100),
  discoveryScore: z.coerce.number().int().min(0).max(100),
  crmScore: z.coerce.number().int().min(0).max(100),
  complianceScore: z.coerce.number().int().min(0).max(100),
  decision: z.enum(["APPROVED_FOR_LIVE", "APPROVED_WITH_COACHING", "NOT_YET_APPROVED"]),
});

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

export default async function CertificationPage() {
  await requireRole(ADMIN_ROLES);
  const agents = await db.agent.findMany({ orderBy: { createdAt: "desc" } });

  async function certify(formData: FormData) {
    "use server";
    const parsed = formSchema.safeParse({
      agentId: formData.get("agentId"),
      productScore: formData.get("productScore"),
      discoveryScore: formData.get("discoveryScore"),
      crmScore: formData.get("crmScore"),
      complianceScore: formData.get("complianceScore"),
      decision: formData.get("decision"),
    });
    if (!parsed.success) throw new Error("Certification values must be scores from 0 to 100.");

    const actor = await requireRole(ADMIN_ROLES);
    const agent = await db.agent.findUnique({ where: { id: parsed.data.agentId } });
    if (!agent) throw new Error("Agent not found.");

    const canClaimLeads = parsed.data.decision !== "NOT_YET_APPROVED";
    await db.$transaction([
      db.certification.create({
        data: {
          agentId: agent.id,
          managerId: actor.id,
          productScore: parsed.data.productScore,
          discoveryScore: parsed.data.discoveryScore,
          crmScore: parsed.data.crmScore,
          complianceScore: parsed.data.complianceScore,
          decision: parsed.data.decision,
          signedAt: new Date(),
        },
      }),
      db.agent.update({ where: { id: agent.id }, data: { canClaimLeads } }),
      db.auditLog.create({
        data: {
          actorUserId: actor.id,
          actorRole: actor.role,
          actionType: "AGENT_CERTIFIED",
          entityType: "Agent",
          entityId: agent.id,
          metadata: { decision: parsed.data.decision, canClaimLeads },
        },
      }),
    ]);
    revalidatePath("/admin/agents");
    revalidatePath("/admin/certification");
    revalidatePath("/portal");
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Agent certification</h1>
      <p className="mt-2 text-gray-400">Certification controls lead eligibility. Active CRM access and lead access are separate decisions.</p>
      <div className="mt-10 space-y-6">
        {agents.map((agent) => (
          <form action={certify} className="rounded-2xl border border-ink-700 bg-ink-900 p-6" key={agent.id}>
            <input name="agentId" type="hidden" value={agent.id} />
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-white">{agent.preferredName || agent.legalName}</h2>
                <p className="mt-1 text-sm text-gray-400">{agent.personalEmail}</p>
              </div>
              <span className={agent.canClaimLeads ? "text-sm text-emerald-300" : "text-sm text-amber-300"}>{agent.canClaimLeads ? "Lead eligible" : "Lead access pending"}</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              {[
                ["productScore", "Product"],
                ["discoveryScore", "Discovery"],
                ["crmScore", "CRM"],
                ["complianceScore", "Compliance"],
              ].map(([name, display]) => (
                <label className="text-sm text-gray-300" key={name}>{display}
                  <input className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-gray-100" defaultValue="80" max="100" min="0" name={name} required type="number" />
                </label>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="text-sm text-gray-300">Decision
                <select className="mt-1 block rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-gray-100" defaultValue="NOT_YET_APPROVED" name="decision">
                  <option value="APPROVED_FOR_LIVE">Approved for live</option>
                  <option value="APPROVED_WITH_COACHING">Approved with coaching</option>
                  <option value="NOT_YET_APPROVED">Not yet approved</option>
                </select>
              </label>
              <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-brand-400" type="submit">Save certification</button>
            </div>
          </form>
        ))}
        {agents.length === 0 && <p className="rounded-2xl border border-ink-700 bg-ink-900 p-6 text-sm text-gray-400">No agents are available for certification yet.</p>}
      </div>
    </main>
  );
}
