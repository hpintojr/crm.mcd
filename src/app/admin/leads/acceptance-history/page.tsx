import Link from "next/link";
import { notFound } from "next/navigation";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import {
  LEAD_PRODUCTION_ACCEPTANCE_ACTION,
  LEAD_PRODUCTION_ACCEPTANCE_ENTITY,
  readLeadProductionAcceptanceMetadata,
  readLeadProductionAcceptanceOutcome,
} from "@/lib/lead-production-acceptance";
import { acceptanceRunbookHref } from "@/lib/acceptance-runbook-links";

export const dynamic = "force-dynamic";

function pacific(value: Date) {
  return value.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Los_Angeles",
  });
}

export default async function LeadAcceptanceHistoryPage() {
  if (!features.leads) notFound();
  const actor = await requireRole(ADMIN_ROLES);
  const records = await db.auditLog.findMany({
    where: {
      actionType: LEAD_PRODUCTION_ACCEPTANCE_ACTION,
      entityType: LEAD_PRODUCTION_ACCEPTANCE_ENTITY,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12" data-acceptance-history="lead-flow">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Lead acceptance history</h1>
          <p className="mt-2 max-w-4xl text-gray-400">
            Chronological read-only timeline of the 200 most recent immutable Lead production acceptance records. Newest evidence appears first.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-overview">Acceptance overview</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-command-center">Command center</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-report">Acceptance report</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-findings">Findings catalog</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/api/admin/leads/acceptance-history.csv">History CSV</Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/leads/testing">Acceptance board</Link>
        </div>
      </div>

      <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-white">Recorded evidence timeline</h2>
            <p className="mt-1 text-sm text-gray-400">{records.length} record{records.length === 1 ? "" : "s"} shown.</p>
          </div>
          <p className="text-xs text-gray-500">Viewed by {actor.email}</p>
        </div>

        {records.length === 0 ? (
          <p className="mt-5 rounded-xl border border-amber-800 bg-ink-950 p-4 text-sm text-amber-200">No production acceptance evidence has been recorded yet.</p>
        ) : (
          <div className="mt-5 divide-y divide-ink-700 overflow-hidden rounded-xl border border-ink-700 bg-ink-950">
            {records.map((record) => {
              const metadata = readLeadProductionAcceptanceMetadata(record.metadata);
              const outcome = readLeadProductionAcceptanceOutcome(record.metadata) || "UNKNOWN";
              const stepId = metadata.stepId || record.entityId || "unknown-step";
              const stepTitle = metadata.stepTitle || record.entityId || "Acceptance step";
              return (
                <article className="grid gap-3 px-5 py-4 md:grid-cols-[10rem_1fr_auto]" data-acceptance-history-record={record.id} key={record.id}>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-gray-500">{pacific(record.createdAt)}</p>
                    <p className="mt-2 text-sm font-medium text-brand-200">{outcome}</p>
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{stepTitle}</h3>
                    <p className="mt-1 text-xs text-gray-500">Reviewer: {record.actorRole || "System"}{record.actorUserId ? ` · ${record.actorUserId}` : ""}</p>
                    <p className="mt-2 text-sm leading-6 text-gray-300">{record.reason || "No note recorded."}</p>
                  </div>
                  <Link className="h-fit rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href={acceptanceRunbookHref(stepId)}>Runbook</Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
