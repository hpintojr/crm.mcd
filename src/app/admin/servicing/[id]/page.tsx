import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { recordPaymentResolved } from "@/lib/client-servicing-resolution";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };
type AccountRow = {
  id: string;
  leadId: string | null;
  clientName: string;
  packageCode: string;
  ghlContactId: string | null;
  status: string;
  healthStatus: string;
  currentOnPayments: boolean;
  accountOwnerAgentId: string | null;
  originatingAgentId: string | null;
  ownerName: string | null;
  originatingName: string | null;
  launchChecklistComplete: boolean;
  lastSuccessfulPaymentAt: Date | null;
  lastPaymentIssueAt: Date | null;
  lastClientRequestAt: Date | null;
  lastSupportResponseAt: Date | null;
  lastResolvedAt: Date | null;
  createdAt: Date;
};
type CaseRow = { id: string; trigger: string; priority: string; status: string; summary: string; openedAt: Date; dueAt: Date | null; resolvedAt: Date | null; resolutionNote: string | null };
type ActivityRow = { id: string; type: string; notes: string | null; occurredAt: Date };

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function pacific(value: Date | null) {
  return value ? value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" }) : "—";
}

export default async function ClientAccountDetailPage({ params }: PageProps) {
  if (!features.servicing) notFound();
  await requireRole(ADMIN_ROLES);
  const { id } = await params;
  const [accounts, cases, activities] = await Promise.all([
    db.$queryRaw<AccountRow[]>(Prisma.sql`
      SELECT account."id", account."leadId", account."clientName", account."packageCode", account."ghlContactId", account."status"::text AS "status", account."healthStatus"::text AS "healthStatus", account."currentOnPayments", account."accountOwnerAgentId", account."originatingAgentId", COALESCE(owner."preferredName", owner."legalName", owner."personalEmail") AS "ownerName", COALESCE(originating."preferredName", originating."legalName", originating."personalEmail") AS "originatingName", account."launchChecklistComplete", account."lastSuccessfulPaymentAt", account."lastPaymentIssueAt", account."lastClientRequestAt", account."lastSupportResponseAt", account."lastResolvedAt", account."createdAt"
      FROM "ClientAccount" account
      LEFT JOIN "Agent" owner ON owner."id"=account."accountOwnerAgentId"
      LEFT JOIN "Agent" originating ON originating."id"=account."originatingAgentId"
      WHERE account."id"=${id}
      LIMIT 1
    `),
    db.$queryRaw<CaseRow[]>(Prisma.sql`
      SELECT "id", "trigger"::text AS "trigger", "priority"::text AS "priority", "status"::text AS "status", "summary", "openedAt", "dueAt", "resolvedAt", "resolutionNote"
      FROM "ClientServiceCase" WHERE "clientAccountId"=${id}
      ORDER BY "openedAt" DESC LIMIT 50
    `),
    db.$queryRaw<ActivityRow[]>(Prisma.sql`
      SELECT "id", "type"::text AS "type", "notes", "occurredAt"
      FROM "ClientServiceActivity" WHERE "clientAccountId"=${id}
      ORDER BY "occurredAt" DESC LIMIT 75
    `),
  ]);
  const account = accounts[0];
  if (!account) notFound();

  async function confirmPaymentClearance(formData: FormData) {
    "use server";
    await recordPaymentResolved({ clientAccountId: String(formData.get("clientAccountId") ?? ""), note: String(formData.get("note") ?? "") });
    revalidatePath(`/admin/servicing/${id}`);
    revalidatePath("/admin/servicing");
    revalidatePath("/admin/servicing/cases");
    revalidatePath("/admin/readiness");
    revalidatePath("/admin/audit");
  }

  return <main className="mx-auto min-h-screen max-w-7xl px-6 py-12"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">{account.clientName}</h1><p className="mt-2 text-gray-400">Client servicing health, documented work history, and controlled service records.</p></div><div className="flex flex-wrap gap-2"><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/servicing">Client servicing</Link>{account.leadId && <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href={`/admin/leads/${account.leadId}`}>Source Lead</Link>}</div></div><section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4"><div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">Account status</p><p className="mt-2 text-xl font-semibold text-white">{label(account.status)}</p><p className="mt-2 text-sm text-gray-400">Launch {account.launchChecklistComplete ? "confirmed" : "pending"}</p></div><div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">Service health</p><p className="mt-2 text-xl font-semibold text-white">{label(account.healthStatus)}</p><p className="mt-2 text-sm text-gray-400">{account.currentOnPayments ? "Current on payments" : "Payment issue recorded"}</p></div><div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">Servicing owner</p><p className="mt-2 text-sm font-semibold text-white">{account.ownerName || "House / unassigned"}</p><p className="mt-2 text-sm text-gray-400">Originating: {account.originatingName || "Not recorded"}</p></div><div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">Package</p><p className="mt-2 text-sm font-semibold text-white">{account.packageCode}</p><p className="mt-2 break-all text-xs text-gray-500">GHL: {account.ghlContactId || "Not linked"}</p></div></section><section className="mt-6 grid gap-5 lg:grid-cols-2"><article className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><h2 className="font-semibold text-white">Service timing</h2><dl className="mt-4 grid gap-3 text-sm"><div><dt className="text-gray-500">Account created</dt><dd className="mt-1 text-gray-200">{pacific(account.createdAt)}</dd></div><div><dt className="text-gray-500">Last successful payment evidence</dt><dd className="mt-1 text-gray-200">{pacific(account.lastSuccessfulPaymentAt)}</dd></div><div><dt className="text-gray-500">Last payment issue</dt><dd className="mt-1 text-gray-200">{pacific(account.lastPaymentIssueAt)}</dd></div><div><dt className="text-gray-500">Last client request</dt><dd className="mt-1 text-gray-200">{pacific(account.lastClientRequestAt)}</dd></div><div><dt className="text-gray-500">Last resolution</dt><dd className="mt-1 text-gray-200">{pacific(account.lastResolvedAt)}</dd></div></dl></article><article className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><h2 className="font-semibold text-white">Payment-clearance record</h2><p className="mt-3 text-sm text-gray-400">Use only after external payment clearance is verified. This records the servicing outcome; it does not collect money, create a payment instruction, change commission eligibility, or invoke Finance.</p>{!account.currentOnPayments ? <form action={confirmPaymentClearance} className="mt-4 grid gap-3"><input name="clientAccountId" type="hidden" value={account.id} /><textarea className="min-h-28 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="note" placeholder="External clearance evidence and date" required /><button className="justify-self-start rounded-lg border border-emerald-700 px-4 py-2 text-sm text-emerald-200" type="submit">Record payment resolved</button></form> : <p className="mt-4 text-sm text-emerald-200">No payment-clearance action is needed while the account is current.</p>}</article></section><section className="mt-6 grid gap-5 lg:grid-cols-2"><article className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900"><div className="border-b border-ink-700 px-5 py-4"><h2 className="font-semibold text-white">Service cases</h2></div>{cases.length === 0 ? <p className="px-5 py-6 text-sm text-gray-400">No service cases recorded.</p> : <div className="divide-y divide-ink-700">{cases.map((serviceCase) => <div className="px-5 py-4" key={serviceCase.id}><p className="font-medium text-white">{label(serviceCase.trigger)} · {label(serviceCase.priority)} · {label(serviceCase.status)}</p><p className="mt-1 text-sm text-gray-300">{serviceCase.summary}</p>{serviceCase.resolutionNote && <p className="mt-2 text-sm text-gray-400">Resolution: {serviceCase.resolutionNote}</p>}<p className="mt-2 text-xs text-gray-500">Opened {pacific(serviceCase.openedAt)} · Due {pacific(serviceCase.dueAt)}{serviceCase.resolvedAt ? ` · Resolved ${pacific(serviceCase.resolvedAt)}` : ""}</p></div>)}</div>}</article><article className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900"><div className="border-b border-ink-700 px-5 py-4"><h2 className="font-semibold text-white">Service activity</h2></div>{activities.length === 0 ? <p className="px-5 py-6 text-sm text-gray-400">No service activity recorded.</p> : <div className="divide-y divide-ink-700">{activities.map((activity) => <div className="px-5 py-4" key={activity.id}><p className="font-medium text-white">{label(activity.type)}</p>{activity.notes && <p className="mt-1 text-sm text-gray-300">{activity.notes}</p>}<p className="mt-2 text-xs text-gray-500">{pacific(activity.occurredAt)}</p></div>)}</div>}</article></section></main>;
}
