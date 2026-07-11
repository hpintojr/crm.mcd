import Link from "next/link";
import { notFound } from "next/navigation";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";
import { leadAcceptanceDeepLinks, type LeadAcceptanceDeepLinkPriority } from "@/lib/lead-acceptance-deep-links";

export const dynamic = "force-dynamic";

function priorityClass(p: LeadAcceptanceDeepLinkPriority) {
  if (p === "OWNER") return "border-brand-700 bg-brand-950/20 text-brand-200";
  if (p === "REVIEW") return "border-amber-700 bg-amber-950/20 text-amber-200";
  if (p === "REFERENCE") return "border-emerald-800 bg-emerald-950/20 text-emerald-200";
  return "border-ink-700 bg-ink-950 text-gray-300";
}

export default async function LeadAcceptanceDeepLinksPage() {
  if (!features.leads) notFound();
  const actor = await requireRole(ADMIN_ROLES);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12" data-deep-links="lead-flow">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Acceptance deep links</h1>
          <p className="mt-2 max-w-4xl text-gray-400">
            Read-only hub of stable hash anchors for the acceptance read-only surfaces. Every entry has a stable `id` so any other page, log, or handoff can link straight to the section. This page reads no Lead data and does not mutate Leads, audit records, feature flags, GHL workflows, imports, exports, or business rules.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/api/admin/leads/deep-links">JSON API</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-overview">Overview</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/owner-decision-prep">Owner decision prep</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/deployment-verification">Deployment verification</Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/leads/testing">Acceptance board</Link>
        </div>
      </div>

      <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6" data-deep-links-index="lead-flow">
        <h2 className="font-semibold text-white">Jump to</h2>
        <p className="mt-2 text-sm text-gray-500">Click any pill to jump to that section on this page. Each section itself links to the underlying read-only surface.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {leadAcceptanceDeepLinks.map((entry) => (
            <Link className={`rounded-full border px-3 py-1 text-xs font-medium ${priorityClass(entry.priority)}`} data-deep-links-index-pill={entry.id} href={`#${entry.id}`} key={entry.id}>
              {entry.title}
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        {leadAcceptanceDeepLinks.map((entry) => (
          <article className="scroll-mt-6 rounded-2xl border border-ink-700 bg-ink-900 p-6" data-deep-links-section={entry.id} id={entry.id} key={entry.id}>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${priorityClass(entry.priority)}`}>{entry.priority}</span>
              <h2 className="font-semibold text-white">{entry.title}</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-gray-400">{entry.description}</p>
            <p className="mt-3 break-all text-xs text-gray-500">Hash anchor: <code className="rounded bg-ink-950 px-1.5 py-0.5 text-brand-200">/admin/leads/deep-links#{entry.id}</code></p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={entry.href}>Open {entry.title.toLowerCase()}</Link>
              <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="#">Back to top</Link>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-2xl border border-amber-900 bg-amber-950/20 p-6">
        <h2 className="font-semibold text-amber-100">Safety boundary</h2>
        <p className="mt-2 text-sm leading-6 text-amber-100/80">
          Viewed by {actor.email}. This hub is a read-only navigation aid. Hamilton-only authenticated production acceptance and the owner production decision remain outside automation.
        </p>
      </section>
    </main>
  );
}
