import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { createClientAccount } from "@/lib/client-servicing-actions";

export const dynamic = "force-dynamic";

type WonLeadRow = {
  leadId: string;
  company: string;
  businessPhone: string;
  email: string | null;
  ownerAgentId: string | null;
  ghlContactId: string | null;
  lastActionAt: Date | null;
};

function pacific(value: Date | null) {
  return value ? value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" }) : "—";
}

export default async function ServicingOnboardingQueuePage() {
  if (!features.leads || !features.servicing) notFound();
  await requireRole(ADMIN_ROLES);
  const [leads, agents] = await Promise.all([
    db.$queryRaw<WonLeadRow[]>(Prisma.sql`
      SELECT lead."id" AS "leadId", lead."company", lead."businessPhone", lead."email", lead."ownerAgentId", lead."ghlContactId", lead."lastActionAt"
      FROM "Lead" lead
      LEFT JOIN "ClientAccount" account ON account."leadId" = lead."id"
      WHERE lead."lifecycle" = 'CLOSED_WON'::"LeadLifecycle"
        AND lead."dnc" = false
        AND lead."suppressed" = false
        AND account."id" IS NULL
      ORDER BY lead."lastActionAt" DESC NULLS LAST, lead."createdAt" ASC
      LIMIT 100
    `),
    db.agent.findMany({ where: { status: "ACTIVE" }, orderBy: [{ preferredName: "asc" }, { legalName: "asc" }], select: { id: true, preferredName: true, legalName: true, personalEmail: true } }),
  ]);

  async function createFromWonLead(formData: FormData) {
    "use server";
    const leadId = String(formData.get("leadId") ?? "").trim();
    const clientName = String(formData.get("clientName") ?? "").trim();
    const packageCode = String(formData.get("packageCode") ?? "").trim();
    const ghlContactId = String(formData.get("ghlContactId") ?? "").trim();
    const originatingAgentId = String(formData.get("originatingAgentId") ?? "").trim();
    const accountOwnerAgentId = String(formData.get("accountOwnerAgentId") ?? "").trim();
    if (!leadId || !clientName || !packageCode) throw new Error("Lead, client name, and package code are required.");
    await createClientAccount({ clientName, packageCode, leadId, ghlContactId: ghlContactId || undefined, originatingAgentId: originatingAgentId || undefined, accountOwnerAgentId: accountOwnerAgentId || undefined });
    revalidatePath("/admin/servicing/onboarding");
    revalidatePath("/admin/servicing");
    revalidatePath("/admin/readiness");
    revalidatePath("/admin/audit");
  }

  return <main className="mx-auto min-h-screen max-w-6xl px-6 py-12"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">Client onboarding queue</h1><p className="mt-2 max-w-3xl text-gray-400">Closed-won Leads that have not yet become Client Service accounts. Account creation preserves the Lead link, originating owner, and GHL contact context without creating a commission or payout record.</p></div><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/servicing">Client servicing</Link></div><section className="mt-6 rounded-xl border border-ink-700 bg-ink-900 px-5 py-4 text-sm text-gray-300">Creating an account starts it in the servicing launch flow. It does not activate a client, create a financial record, or change commission eligibility.</section><section className="mt-8 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900"><div className="border-b border-ink-700 px-6 py-4"><h2 className="font-semibold text-white">Ready for onboarding</h2></div>{leads.length === 0 ? <p className="px-6 py-10 text-sm text-gray-400">No won Leads are awaiting Client Service account creation.</p> : <div className="divide-y divide-ink-700">{leads.map((lead) => <article className="px-6 py-5" key={lead.leadId}><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start"><div><p className="font-medium text-white">{lead.company}</p><p className="mt-1 text-sm text-gray-400">{lead.businessPhone} · {lead.email || "No email recorded"}</p><p className="mt-1 text-xs text-gray-500">GHL contact: {lead.ghlContactId || "Not linked"} · Won activity: {pacific(lead.lastActionAt)}</p></div><Link className="shrink-0 rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href={`/admin/leads/${lead.leadId}`}>Lead detail</Link></div><form action={createFromWonLead} className="mt-5 grid gap-3 border-t border-ink-700 pt-5 lg:grid-cols-[1.2fr_0.9fr_1fr_auto]"><input name="leadId" type="hidden" value={lead.leadId} /><input name="clientName" type="hidden" value={lead.company} /><input name="ghlContactId" type="hidden" value={lead.ghlContactId || ""} /><input name="originatingAgentId" type="hidden" value={lead.ownerAgentId || ""} /><input className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="packageCode" placeholder="Package code" required /><select className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="accountOwnerAgentId" defaultValue={agents.some((agent) => agent.id === lead.ownerAgentId) ? lead.ownerAgentId || "" : ""}><option value="">Assign later / House review</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.preferredName || agent.legalName} · {agent.personalEmail}</option>)}</select><p className="self-center text-xs text-gray-500">Originating agent context stays attached for policy and audit purposes.</p><button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950" type="submit">Create service account</button></form></article>)}</div>}</section></main>;
}
