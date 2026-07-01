import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { claimAvailableRecord } from "@/lib/workflow";

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

export default async function LeadsPage() {
  if (!features.leads) notFound();
  const user = await requireRole(["AGENT", ...ADMIN_ROLES]);
  const agent = await db.agent.findUnique({ where: { userId: user.id } });
  const [available, mine] = await Promise.all([
    db.lead.findMany({
      where: { ownerAgentId: null, lifecycle: "AVAILABLE", dnc: false, suppressed: false },
      orderBy: [{ pool: "asc" }, { score: "desc" }, { createdAt: "asc" }],
      take: 100,
    }),
    agent ? db.lead.findMany({
      where: { ownerAgentId: agent.id, dnc: false, suppressed: false },
      orderBy: [{ nextActionAt: "asc" }, { lastActionAt: "desc" }],
      take: 100,
    }) : Promise.resolve([]),
  ]);

  async function claim(formData: FormData) {
    "use server";
    const actor = await requireRole(["AGENT", ...ADMIN_ROLES]);
    const leadId = String(formData.get("leadId") ?? "");
    if (!leadId) throw new Error("Lead is required.");
    await claimAvailableRecord({ userId: actor.id, role: actor.role }, leadId);
    revalidatePath("/portal/leads");
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Lead workspace</h1>
      <p className="mt-2 text-gray-400">Only work company-owned records. Log each meaningful interaction, next step, and opt-out immediately.</p>

      <section className="mt-10 grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-ink-700 bg-ink-900">
          <div className="border-b border-ink-700 px-6 py-4">
            <h2 className="font-semibold text-white">Available pool</h2>
            <p className="mt-1 text-sm text-gray-400">Claiming is atomic. A record can only be assigned once.</p>
          </div>
          {available.length === 0 ? <p className="px-6 py-10 text-sm text-gray-400">No available records.</p> : (
            <div className="divide-y divide-ink-700">
              {available.map((lead) => (
                <article className="flex flex-wrap items-center justify-between gap-4 px-6 py-5" key={lead.id}>
                  <div>
                    <p className="font-medium text-white">{lead.company}</p>
                    <p className="mt-1 text-sm text-gray-400">{lead.industry || "Industry pending"} · {lead.city || "Location pending"}</p>
                    <p className="mt-1 text-xs text-gray-500">{label(lead.pool)} · Score {lead.score}</p>
                  </div>
                  {agent?.canClaimLeads && (
                    <form action={claim}>
                      <input name="leadId" type="hidden" value={lead.id} />
                      <button className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-ink-950 hover:bg-brand-400" type="submit">Claim</button>
                    </form>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-ink-700 bg-ink-900">
          <div className="border-b border-ink-700 px-6 py-4">
            <h2 className="font-semibold text-white">My active records</h2>
            <p className="mt-1 text-sm text-gray-400">Callbacks and next actions are shown first.</p>
          </div>
          {mine.length === 0 ? <p className="px-6 py-10 text-sm text-gray-400">No records are assigned to you.</p> : (
            <div className="divide-y divide-ink-700">
              {mine.map((lead) => (
                <a className="block px-6 py-5 hover:bg-ink-950" href={`/portal/leads/${lead.id}`} key={lead.id}>
                  <p className="font-medium text-white">{lead.company}</p>
                  <p className="mt-1 text-sm text-gray-400">{lead.businessPhone} · {label(lead.lifecycle)}</p>
                  <p className="mt-1 text-xs text-gray-500">Next action: {lead.nextActionAt ? lead.nextActionAt.toLocaleString() : "Not scheduled"}</p>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
