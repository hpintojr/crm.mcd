import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";

export const dynamic = "force-dynamic";

type AccountRow = {
  id: string;
  clientName: string;
  packageCode: string;
  status: string;
  healthStatus: string;
  currentOnPayments: boolean;
  accountOwnerAgentId: string | null;
  originatingAgentId: string | null;
  ghlLocationId: string | null;
  ghlContactId: string | null;
  lastSuccessfulPaymentAt: Date | null;
  lastPaymentIssueAt: Date | null;
  lastClientRequestAt: Date | null;
  lastSupportResponseAt: Date | null;
  lastEscalationAt: Date | null;
  lastResolvedAt: Date | null;
  nextRenewalAt: Date | null;
  houseTransferredAt: Date | null;
  houseTransferReason: string | null;
};

type ServiceCaseRow = { id: string; trigger: string; priority: string; status: string; summary: string; openedAt: Date; dueAt: Date | null; resolvedAt: Date | null; resolutionNote: string | null };
type ServiceActivityRow = { id: string; type: string; notes: string | null; metadata: unknown; occurredAt: Date };
type AssignmentRow = { id: string; reason: string; note: string | null; createdAt: Date; fromAgentId: string | null; toAgentId: string | null };

function label(value: string | null) {
  return value ? value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase()) : "—";
}

function pacific(value: Date | null) {
  return value ? value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" }) : "—";
}

export default async function AdminClientServiceDetailPage({ params }: { params: Promise<{ clientAccountId: string }> }) {
  if (!features.servicing) notFound();
  await requireRole(ADMIN_ROLES);
  const { clientAccountId } = await params;
  const [accounts, cases, activities, assignments] = await Promise.all([
    db.$queryRaw<AccountRow[]>(Prisma.sql`SELECT "id", "clientName", "packageCode", "status"::text AS "status", "healthStatus"::text AS "healthStatus", "currentOnPayments", "accountOwnerAgentId", "originatingAgentId", "ghlLocationId", "ghlContactId", "lastSuccessfulPaymentAt", "lastPaymentIssueAt", "lastClientRequestAt", "lastSupportResponseAt", "lastEscalationAt", "lastResolvedAt", "nextRenewalAt", "houseTransferredAt", "houseTransferReason" FROM "ClientAccount" WHERE "id"=${clientAccountId}`),
    db.$queryRaw<ServiceCaseRow[]>(Prisma.sql`SELECT "id", "trigger"::text AS "trigger", "priority"::text AS "priority", "status"::text AS "status", "summary", "openedAt", "dueAt", "resolvedAt", "resolutionNote" FROM "ClientServiceCase" WHERE "clientAccountId"=${clientAccountId} ORDER BY "openedAt" DESC LIMIT 100`),
    db.$queryRaw<ServiceActivityRow[]>(Prisma.sql`SELECT "id", "type"::text AS "type", "notes", "metadata", "occurredAt" FROM "ClientServiceActivity" WHERE "clientAccountId"=${clientAccountId} ORDER BY "occurredAt" DESC LIMIT 100`),
    db.$queryRaw<AssignmentRow[]>(Prisma.sql`SELECT "id", "reason"::text AS "reason", "note", "createdAt", "fromAgentId", "toAgentId" FROM "ClientServiceAssignmentEvent" WHERE "clientAccountId"=${clientAccountId} ORDER BY "createdAt" DESC LIMIT 100`),
  ]);
  const account = accounts[0];
  if (!account) notFound();

  return <main className="mx-auto min-h-screen max-w-7xl px-6 py-12"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">{account.clientName}</h1><p className="mt-2 text-gray-400">{account.packageCode} · {label(account.healthStatus)} · {account.currentOnPayments ? "Current on payments" : "Payment issue"}</p></div><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/servicing">Client servicing</Link></div>
    <section className="mt-8 grid gap-4 md:grid-cols-4"><div className="rounded-xl border border-ink-700 bg-ink-900 p-4"><p className="text-xs text-gray-500">Account status</p><p className="mt-1 font-medium text-white">{label(account.status)}</p></div><div className="rounded-xl border border-ink-700 bg-ink-900 p-4"><p className="text-xs text-gray-500">Last client request</p><p className="mt-1 text-sm text-white">{pacific(account.lastClientRequestAt)}</p></div><div className="rounded-xl border border-ink-700 bg-ink-900 p-4"><p className="text-xs text-gray-500">Last support response</p><p className="mt-1 text-sm text-white">{pacific(account.lastSupportResponseAt)}</p></div><div className="rounded-xl border border-ink-700 bg-ink-900 p-4"><p className="text-xs text-gray-500">Last resolution</p><p className="mt-1 text-sm text-white">{pacific(account.lastResolvedAt)}</p></div></section>
    <section className="mt-6 grid gap-6 xl:grid-cols-2"><article className="rounded-2xl border border-ink-700 bg-ink-900 p-6"><h2 className="font-semibold text-white">Account context</h2><dl className="mt-4 grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2"><div><dt className="text-gray-500">Next renewal</dt><dd className="text-gray-200">{pacific(account.nextRenewalAt)}</dd></div><div><dt className="text-gray-500">Last successful payment</dt><dd className="text-gray-200">{pacific(account.lastSuccessfulPaymentAt)}</dd></div><div><dt className="text-gray-500">Last payment issue</dt><dd className="text-gray-200">{pacific(account.lastPaymentIssueAt)}</dd></div><div><dt className="text-gray-500">Last escalation</dt><dd className="text-gray-200">{pacific(account.lastEscalationAt)}</dd></div><div><dt className="text-gray-500">GHL contact</dt><dd className="break-all text-gray-200">{account.ghlContactId || "—"}</dd></div><div><dt className="text-gray-500">GHL location</dt><dd className="break-all text-gray-200">{account.ghlLocationId || "—"}</dd></div></dl></article><article className="rounded-2xl border border-ink-700 bg-ink-900 p-6"><h2 className="font-semibold text-white">House and assignment context</h2><p className="mt-3 text-sm text-gray-300">Current servicing agent ID: {account.accountOwnerAgentId || "House / unassigned"}</p><p className="mt-2 text-sm text-gray-300">Originating agent ID: {account.originatingAgentId || "Not recorded"}</p><p className="mt-2 text-sm text-gray-300">House transfer: {pacific(account.houseTransferredAt)}</p><p className="mt-2 text-sm text-gray-300">Transfer note: {account.houseTransferReason || "—"}</p></article></section>
    <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]"><article className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900"><div className="border-b border-ink-700 px-6 py-4"><h2 className="font-semibold text-white">Service cases</h2></div>{cases.length === 0 ? <p className="px-6 py-8 text-sm text-gray-400">No service cases.</p> : <div className="divide-y divide-ink-700">{cases.map((serviceCase) => <div className="px-6 py-4" key={serviceCase.id}><p className="font-medium text-white">{label(serviceCase.trigger)} · {label(serviceCase.priority)} · {label(serviceCase.status)}</p><p className="mt-1 text-sm text-gray-300">{serviceCase.summary}</p><p className="mt-1 text-xs text-gray-500">Opened {pacific(serviceCase.openedAt)} · Due {pacific(serviceCase.dueAt)} · Resolved {pacific(serviceCase.resolvedAt)}</p>{serviceCase.resolutionNote && <p className="mt-2 rounded-lg bg-ink-950 p-2 text-sm text-gray-300">{serviceCase.resolutionNote}</p>}</div>)}</div>}</article><article className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900"><div className="border-b border-ink-700 px-6 py-4"><h2 className="font-semibold text-white">Assignment history</h2></div>{assignments.length === 0 ? <p className="px-6 py-8 text-sm text-gray-400">No assignment events.</p> : <div className="divide-y divide-ink-700">{assignments.map((assignment) => <div className="px-6 py-4" key={assignment.id}><p className="font-medium text-white">{label(assignment.reason)}</p><p className="mt-1 text-sm text-gray-300">{assignment.note || "No note"}</p><p className="mt-1 text-xs text-gray-500">From {assignment.fromAgentId || "House"} to {assignment.toAgentId || "House"} · {pacific(assignment.createdAt)}</p></div>)}</div>}</article></section>
    <section className="mt-6 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900"><div className="border-b border-ink-700 px-6 py-4"><h2 className="font-semibold text-white">Service activity</h2></div>{activities.length === 0 ? <p className="px-6 py-8 text-sm text-gray-400">No service activity.</p> : <div className="divide-y divide-ink-700">{activities.map((activity) => <div className="px-6 py-4" key={activity.id}><p className="font-medium text-white">{label(activity.type)}</p>{activity.notes && <p className="mt-1 text-sm text-gray-300">{activity.notes}</p>}<p className="mt-1 text-xs text-gray-500">{pacific(activity.occurredAt)}</p>{activity.metadata && <pre className="mt-2 overflow-x-auto rounded-lg bg-ink-950 p-2 text-xs text-gray-400">{JSON.stringify(activity.metadata, null, 2)}</pre>}</div>)}</div>}</section>
  </main>;
}
