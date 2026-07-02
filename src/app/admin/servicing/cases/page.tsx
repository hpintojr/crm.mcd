import Link from "next/link";
import { notFound } from "next/navigation";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";
import { listOpenServiceCases } from "@/lib/client-servicing";

export const dynamic = "force-dynamic";

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

export default async function ServiceCasesPage() {
  if (!features.servicing) notFound();
  await requireRole(ADMIN_ROLES);
  const cases = await listOpenServiceCases();

  return <main className="mx-auto min-h-screen max-w-6xl px-6 py-12"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">Service cases</h1><p className="mt-2 text-gray-400">Open client work ordered by priority and due time.</p></div><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/servicing">Client servicing</Link></div><section className="mt-8 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">{cases.length === 0 ? <p className="px-6 py-10 text-sm text-gray-400">No open service cases.</p> : <div className="divide-y divide-ink-700">{cases.map((serviceCase) => <article className="flex flex-wrap items-center justify-between gap-4 px-6 py-5" key={serviceCase.id}><div><Link className="font-medium text-white hover:text-brand-200" href={`/admin/servicing/${serviceCase.clientAccountId}`}>{serviceCase.clientName}</Link><p className="mt-1 text-sm text-gray-400">{serviceCase.summary}</p><p className="mt-1 text-xs text-gray-500">{label(serviceCase.trigger)} · {label(serviceCase.priority)} · {label(serviceCase.status)}</p></div><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href={`/admin/servicing/${serviceCase.clientAccountId}`}>Open client</Link></article>)}</div>}</section></main>;
}
