import Link from "next/link";
import { Prisma } from "@prisma/client";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";

type CountRow = { count: number };

export const dynamic = "force-dynamic";

async function rawCount(query: Prisma.Sql) {
  const rows = await db.$queryRaw<CountRow[]>(query);
  return rows[0]?.count ?? 0;
}

export default async function ReadinessBoardPage() {
  await requireRole(ADMIN_ROLES);
  const [pendingLeads, demoBooked, closedWonUnonboarded, launchPending, openCases, integrationErrors] = await Promise.all([
    db.lead.count({ where: { lifecycle: { in: ["RAW", "PENDING_REVIEW"] }, suppressed: false } }),
    db.lead.count({ where: { lifecycle: "DEMO_BOOKED", dnc: false, suppressed: false, ghlContactId: null } }),
    rawCount(Prisma.sql`SELECT COUNT(*)::int AS "count" FROM "Lead" lead LEFT JOIN "ClientAccount" account ON account."leadId"=lead."id" WHERE lead."lifecycle"='CLOSED_WON'::"LeadLifecycle" AND lead."dnc"=false AND lead."suppressed"=false AND account."id" IS NULL`),
    rawCount(Prisma.sql`SELECT COUNT(*)::int AS "count" FROM "ClientAccount" WHERE "launchChecklistComplete"=false AND "status"='PENDING_LAUNCH'::"ClientAccountStatus"`),
    rawCount(Prisma.sql`SELECT COUNT(*)::int AS "count" FROM "ClientServiceCase" WHERE "status" IN ('OPEN'::"ClientServiceCaseStatus",'IN_PROGRESS'::"ClientServiceCaseStatus",'WAITING_ON_CLIENT'::"ClientServiceCaseStatus")`),
    db.integrationError.count({ where: { resolved: false } }),
  ]);

  const cards = [
    { label: "Lead MVP acceptance", value: features.leads ? "Run now" : "Staged", href: "/admin/leads/testing", detail: "Run the owner-approved import, ownership, DNC, Open Pool, and GHL attribution checks before normal Lead use." },
    { label: "Client Servicing acceptance", value: features.servicing ? "Run now" : "Staged", href: "/admin/servicing/testing", detail: "Validate onboarding, launch, triggered cases, healthy-account protection, and documented House handling." },
    { label: "Commission acceptance", value: features.commissions ? "Run now" : "Staged", href: "/admin/commissions/testing", detail: "Validate policy, eligibility, holds, payment clearance, audit evidence, and no-money-movement boundaries." },
    { label: "Pending Lead review", value: pendingLeads, href: "/admin/leads", detail: "Review source, duplicates, and suppression before pool assignment." },
    { label: "Demo-booked handoffs", value: demoBooked, href: "/admin/leads/handoff", detail: "Send eligible demo-booked Leads to GHL through the controlled handoff queue." },
    { label: "Won Leads awaiting onboarding", value: closedWonUnonboarded, href: "/admin/servicing/onboarding", detail: "Create the Client Service account, then document client launch." },
    { label: "Launch confirmations pending", value: launchPending, href: "/admin/servicing/launches", detail: "Activate newly created client accounts through documented launch confirmation." },
    { label: "Open service cases", value: openCases, href: "/admin/servicing/cases", detail: "Triggered client work requiring response, resolution, or escalation follow-up." },
    { label: "Unresolved integrations", value: integrationErrors, href: "/admin/integrations", detail: "Review webhook and backend integration failures before normal rollout." },
  ];

  return <main className="mx-auto min-h-screen max-w-7xl px-6 py-12"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">Readiness board</h1><p className="mt-2 max-w-4xl text-gray-400">Live operational counts for the controlled rollout. Counts do not enable any feature; feature gates remain independent.</p></div><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/operating-status">Operating status</Link></div><section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{cards.map((card) => <Link className="rounded-2xl border border-ink-700 bg-ink-900 p-6 transition hover:border-brand-500" href={card.href} key={card.label}><p className="text-sm text-gray-400">{card.label}</p><p className="mt-2 text-4xl font-semibold text-white">{card.value}</p><p className="mt-4 text-sm leading-6 text-gray-300">{card.detail}</p></Link>)}</section><section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6"><h2 className="font-semibold text-white">Feature gate state</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Gate name="Leads" enabled={features.leads} /><Gate name="Servicing" enabled={features.servicing} /><Gate name="Commissions" enabled={features.commissions} /><Gate name="Finance" enabled={features.finance} /></div></section></main>;
}

function Gate({ name, enabled }: { name: string; enabled: boolean }) {
  return <div className="rounded-xl border border-ink-700 bg-ink-950 p-4"><p className="text-sm text-gray-300">{name}</p><p className={`mt-2 text-sm font-medium ${enabled ? "text-emerald-200" : "text-gray-400"}`}>{enabled ? "Controlled test enabled" : "Staged / locked"}</p></div>;
}
