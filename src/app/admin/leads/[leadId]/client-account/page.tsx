import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { createClientAccountFromWonLead } from "@/lib/lead-client-account";

export const dynamic = "force-dynamic";

type ExistingAccount = { id: string };

export default async function CreateClientAccountFromLeadPage({ params }: { params: Promise<{ leadId: string }> }) {
  if (!features.leads || !features.servicing) notFound();
  await requireRole(ADMIN_ROLES);
  const { leadId } = await params;
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) notFound();
  if (lead.lifecycle !== "CLOSED_WON" || lead.dnc || lead.suppressed) notFound();

  const existing = await db.$queryRaw<ExistingAccount[]>`
    SELECT "id" FROM "ClientAccount" WHERE "leadId" = ${lead.id} LIMIT 1
  `;
  if (existing[0]) redirect(`/admin/servicing/${existing[0].id}/launch`);

  async function create(formData: FormData) {
    "use server";
    const result = await createClientAccountFromWonLead({ leadId, packageCode: String(formData.get("packageCode") ?? "") });
    redirect(`/admin/servicing/${result.clientAccountId}/launch`);
  }

  return <main className="mx-auto min-h-screen max-w-3xl px-6 py-12"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">Create client account</h1><p className="mt-2 text-gray-400">Create the servicing record from a closed-won Lead. The next step documents the client launch before normal service workflow begins.</p></div><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href={`/admin/leads/${lead.id}`}>Lead detail</Link></div><section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6"><h2 className="text-lg font-semibold text-white">{lead.company}</h2><p className="mt-1 text-sm text-gray-400">{lead.businessPhone} · {lead.email || "No email recorded"}</p><p className="mt-4 text-sm text-gray-300">The lead link, GHL contact mapping, and current sales owner context will be retained on the client account. This does not create a commission entry, payment record, or payout action.</p><form action={create} className="mt-6 grid gap-3"><input className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="packageCode" placeholder="Package code" required /><button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950" type="submit">Create client account and continue</button></form></section></main>;
}
