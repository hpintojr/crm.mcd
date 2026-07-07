import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const IMPORT_REVIEW_ROLES = ["OWNER", "SUPER_ADMIN", "COMPLIANCE_MANAGER"] as const;

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function pacific(value?: Date | null) {
  if (!value) return "Not yet";
  return value.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Los_Angeles",
  });
}

function issues(value: unknown) {
  return Array.isArray(value) ? value.filter((issue): issue is string => typeof issue === "string") : [];
}

export default async function LeadImportBatchDetailPage({ params }: { params: Promise<{ batchId: string }> }) {
  await requireRole([...IMPORT_REVIEW_ROLES]);
  const { batchId } = await params;

  const batch = await db.leadImportBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      localRunId: true,
      status: true,
      sourceAdapter: true,
      sourceAdapterVersion: true,
      clientVersion: true,
      rowCount: true,
      insertedCount: true,
      duplicateCount: true,
      suppressedCount: true,
      rejectedCount: true,
      approvalReference: true,
      approvalRecordedAt: true,
      submittedAt: true,
      completedAt: true,
      failureReason: true,
      createdAt: true,
      updatedAt: true,
      rows: {
        orderBy: { rowNumber: "asc" },
        select: {
          id: true,
          rowNumber: true,
          status: true,
          issues: true,
          createdLeadId: true,
          existingLeadId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!batch) notFound();

  const rowIds = batch.rows.map((row) => row.id);
  const leadIds = batch.rows
    .flatMap((row) => [row.createdLeadId, row.existingLeadId])
    .filter((id): id is string => Boolean(id));
  const audit = await db.auditLog.findMany({
    where: {
      OR: [
        { entityType: "LeadImportBatch", entityId: batch.id },
        ...(rowIds.length ? [{ entityType: "LeadImportRow", entityId: { in: rowIds } }] : []),
        ...(leadIds.length ? [{ entityType: "Lead", entityId: { in: leadIds } }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      actionType: true,
      actorRole: true,
      entityType: true,
      entityId: true,
      reason: true,
      createdAt: true,
    },
  });

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Import batch review</h1>
          <p className="mt-2 max-w-3xl text-gray-400">
            Read-only batch evidence. Payloads, contact data, signed headers, and write controls are intentionally excluded.
          </p>
        </div>
        <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-brand-300 hover:border-brand-500 hover:text-brand-200" href="/admin/lead-imports">
          Back to batches
        </Link>
      </div>

      <section className="mt-10 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-white">{batch.localRunId}</h2>
              <span className="rounded-full border border-ink-700 px-2 py-0.5 text-xs text-gray-300">{label(batch.status)}</span>
            </div>
            <p className="mt-3 text-sm text-gray-400">Batch ID: <span className="font-mono text-xs">{batch.id}</span></p>
            <p className="mt-1 text-sm text-gray-400">Adapter: {batch.sourceAdapter} {batch.sourceAdapterVersion} · Client: {batch.clientVersion}</p>
            <p className="mt-1 text-sm text-gray-400">Created {pacific(batch.createdAt)} PT · Updated {pacific(batch.updatedAt)} PT</p>
            <p className="mt-1 text-sm text-gray-400">Approval: {batch.approvalReference ?? "Not recorded"} · Recorded: {pacific(batch.approvalRecordedAt)} PT</p>
            <p className="mt-1 text-sm text-gray-400">Submitted: {pacific(batch.submittedAt)} PT · Completed: {pacific(batch.completedAt)} PT</p>
            {batch.failureReason && <p className="mt-4 rounded-lg border border-red-900/70 bg-red-950/30 px-3 py-2 text-sm text-red-200">Reconciliation note: {batch.failureReason}</p>}
          </div>
          <dl className="grid grid-cols-2 gap-x-7 gap-y-3 text-sm text-gray-300 sm:grid-cols-3">
            <div><dt className="text-gray-500">Rows</dt><dd>{batch.rowCount}</dd></div>
            <div><dt className="text-gray-500">Inserted</dt><dd>{batch.insertedCount ?? 0}</dd></div>
            <div><dt className="text-gray-500">Duplicates</dt><dd>{batch.duplicateCount ?? 0}</dd></div>
            <div><dt className="text-gray-500">Suppressed</dt><dd>{batch.suppressedCount ?? 0}</dd></div>
            <div><dt className="text-gray-500">Rejected</dt><dd>{batch.rejectedCount ?? 0}</dd></div>
            <div><dt className="text-gray-500">Audit events</dt><dd>{audit.length}</dd></div>
          </dl>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        <div className="border-b border-ink-700 px-6 py-4">
          <h2 className="font-semibold text-white">Row outcomes</h2>
          <p className="mt-1 text-sm text-gray-400">Internal row numbers and outcome evidence only. No imported payload is displayed.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-ink-700 text-left text-sm">
            <thead className="bg-ink-950/60 text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="px-5 py-3">Row</th><th className="px-5 py-3">Outcome</th><th className="px-5 py-3">Evidence</th><th className="px-5 py-3">Related record</th><th className="px-5 py-3">Updated</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {batch.rows.map((row) => {
                const rowIssues = issues(row.issues);
                return (
                  <tr key={row.id} className="text-gray-300">
                    <td className="px-5 py-3 font-mono text-xs">{row.rowNumber}</td>
                    <td className="px-5 py-3">{label(row.status)}</td>
                    <td className="px-5 py-3 text-gray-400">{rowIssues.length ? rowIssues.join(" ") : "No additional evidence recorded."}</td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-400">{row.createdLeadId ?? row.existingLeadId ?? "—"}</td>
                    <td className="px-5 py-3 text-gray-400">{pacific(row.updatedAt)} PT</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        <div className="border-b border-ink-700 px-6 py-4">
          <h2 className="font-semibold text-white">Audit timeline</h2>
          <p className="mt-1 text-sm text-gray-400">Latest 100 related audit records. Audit metadata is intentionally omitted.</p>
        </div>
        {audit.length === 0 ? (
          <p className="px-6 py-8 text-sm text-gray-400">No related audit records are available.</p>
        ) : (
          <div className="divide-y divide-ink-700">
            {audit.map((entry) => (
              <div className="px-6 py-4" key={entry.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-gray-200">{label(entry.actionType)}</p>
                  <p className="text-xs text-gray-500">{pacific(entry.createdAt)} PT</p>
                </div>
                <p className="mt-1 text-sm text-gray-400">{entry.entityType} · <span className="font-mono text-xs">{entry.entityId ?? "—"}</span> · {entry.actorRole ?? "System"}</p>
                {entry.reason && <p className="mt-2 text-sm text-gray-300">{entry.reason}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
