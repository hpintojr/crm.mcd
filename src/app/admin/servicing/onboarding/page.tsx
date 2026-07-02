import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";

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
  const leads = await db.$queryRaw<WonLeadRow[]>(Prisma.sql`
    SELECT lead."id" AS "leadId", lead."company", lead."businessPhone", lead."email", lead."ownerAgentId", lead."ghlContactId", lead."lastActionAt"
    FROM "Lead" lead
    LEFT JOIN "ClientAccount" account ON account."leadId" = lead."id"
    WHERE lead."lifecycle" = 'CLOSED_WON'::"LeadLifecycle"
      AND lead."dnc" = false
      AND lead."suppressed" = false
      AND account."id" IS NULL
    ORDER BY lead."lastActionAt" DESC NULLS LAST, lead."createdAt" ASC
    LIMIT 100
  `);

  return <main className="mx-auto min-h-screen max-w-6xl px-6 py-12"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">Client onboarding queue</h1><p className="mt-2 max-w-3xl text-gray-400">Closed-won Leads that have not yet become Client Service accounts. Creation retains the Lead link, current owner context, and GHL contact mapping, without creating a commission or payout record.</p></div><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/servicing">Client servicing</Link></div><section className="mt-8 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900"><div className="border-b border-ink-700 px-6 py-4"><h2 className="font-semibold text-white">Ready for onboarding</h2></div>{leads.length === 0 ? <p className="px-6 py-10 text-sm text-gray-400">No won Leads are awaiting Client Service account creation.</p> : <div className="divide-y divide-ink-700">{leads.map((lead) => <article className="flex flex-col justify-between gap-4 px-6 py-5 lg:flex-row lg:items-center" key={lead.leadId}><div><p className="font-medium text-white">{lead.company}</p><p className="mt-1 text-sm text-gray-400">{lead.businessPhone} · {lead.email || "No email recorded"}</p><p className="mt-1 text-xs text-gray-500">GHL contact: {lead.ghlContactId || "Not linked"} · Won activity: {pacific(lead.lastActionAt)}</p></div><div className="flex gap-2"><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href={`/admin/leads/${lead.leadId}`}>Lead detail</Link><Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={`/admin/leads/${lead.leadId}/client-account`}>Create client account</Link></div></article>)}</div>}</section></main>;
}
