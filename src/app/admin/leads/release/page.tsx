import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { releaseLeadToOpenPool } from "@/lib/open-pool-release";

export const dynamic = "force-dynamic";

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

export default async function OpenPoolReleasePage() {
  if (!features.leads) notFound();
  await requireRole(ADMIN_ROLES);
  const candidates = await db.lead.findMany({
    where: {
      ownerAgentId: { not: null },
      twoWayContactAt: { not: null },
      lifecycle: { in: ["CLAIMED", "CONTACTED", "NURTURING", "DEMO_BOOKED"] },
      dnc: false,
      suppressed: false,
      isReferral: false,
      pool: { not: "REFERRAL" },
    },
    orderBy: { lastActionAt: "asc" },
    take: 100,
  });

  async function release(formData: FormData) {
    "use server";
    await releaseLeadToOpenPool({
      leadId: String(formData.get("leadId") ?? ""),
      reason: String(formData.get("reason") ?? ""),
    });
    revalidatePath("/admin/leads/release");
    revalidatePath("/admin/leads");
    revalidatePath("/portal/leads");
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">Open Pool returns</h1><p className="mt-2 text-gray-400">Only previously assigned, non-referral records with documented two-way contact can be returned. Every return is audited.</p></div><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/leads">Lead review</Link></div>
      <section className="mt-10 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900"><div className="border-b border-ink-700 px-6 py-4"><h2 className="font-semibold text-white">Eligible return records</h2><p className="mt-1 text-sm text-gray-400">Referrals, suppressed records, and untouched cold leads are excluded.</p></div>{candidates.length === 0 ? <p className="px-6 py-10 text-sm text-gray-400">No records currently meet the Open Pool return controls.</p> : <div className="divide-y divide-ink-700">{candidates.map((lead) => <article className="px-6 py-5" key={lead.id}><div className="flex flex-col justify-between gap-5 xl:flex-row"><div><p className="font-medium text-white">{lead.company}</p><p className="mt-1 text-sm text-gray-400">{lead.businessPhone} · {label(lead.lifecycle)}</p><p className="mt-1 text-xs text-gray-500">Last action: {lead.lastActionAt?.toLocaleString() || "Not recorded"}</p></div><form action={release} className="grid min-w-80 grid-cols-[1fr_auto] gap-2"><input name="leadId" type="hidden" value={lead.id} /><input className="min-w-0 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="reason" placeholder="Return reason: no-show, declined, unresponsive..." minLength={3} required /><button className="rounded-lg border border-brand-500 px-3 py-2 text-sm font-medium text-brand-200" type="submit">Release</button></form></div></article>)}</div>}</section>
    </main>
  );
}
