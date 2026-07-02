import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { handoffDemoBookedLeadToGhl } from "@/lib/lead-ghl-handoff";

export const dynamic = "force-dynamic";

export default async function LeadGhlHandoffPage() {
  if (!features.leads) notFound();
  await requireRole(ADMIN_ROLES);
  const leads = await db.lead.findMany({
    where: { lifecycle: "DEMO_BOOKED", dnc: false, suppressed: false },
    orderBy: { lastActionAt: "desc" },
    take: 100,
  });

  async function handoff(formData: FormData) {
    "use server";
    await handoffDemoBookedLeadToGhl({ leadId: String(formData.get("leadId") ?? "") });
    revalidatePath("/admin/leads/handoff");
  }

  return <main className="mx-auto min-h-screen max-w-6xl px-6 py-12"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">Demo-booked GHL handoff</h1><p className="mt-2 max-w-3xl text-gray-400">Only non-suppressed demo-booked leads can be handed off. The handoff records the GHL contact ID and audit history; it never transfers ownership or gives agents GHL access.</p></div><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/leads">Lead review</Link></div><section className="mt-8 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900"><div className="border-b border-ink-700 px-6 py-4"><h2 className="font-semibold text-white">Eligible demo-booked leads</h2></div>{leads.length === 0 ? <p className="px-6 py-10 text-sm text-gray-400">No eligible demo-booked leads are waiting for GHL handoff.</p> : <div className="divide-y divide-ink-700">{leads.map((lead) => <article className="flex flex-col justify-between gap-4 px-6 py-5 lg:flex-row lg:items-center" key={lead.id}><div><p className="font-medium text-white">{lead.company}</p><p className="mt-1 text-sm text-gray-400">{lead.businessPhone} · {lead.email || "No email recorded"}</p><p className="mt-1 text-xs text-gray-500">{lead.ghlContactId ? `GHL linked: ${lead.ghlContactId}` : "Not yet handed off"}</p></div>{lead.ghlContactId ? <span className="rounded-full border border-emerald-700 px-3 py-1 text-xs text-emerald-200">Linked</span> : <form action={handoff}><input name="leadId" type="hidden" value={lead.id} /><button className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" type="submit">Handoff to GHL</button></form>}</article>)}</div>}</section></main>;
}
