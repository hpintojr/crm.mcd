import Link from "next/link";
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

export default async function LeadImportReconciliationPage() {
  const actor = await requireRole([...IMPORT_REVIEW_ROLES]);
  const batches = await db.leadImportBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      localRunId: true,
      status: true,
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
        },
      },
    },
  });

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Lead import reconciliation</h1>
          <p className="mt-2 max-w-3xl text-gray-400">
            Read-only review of signed import batches. This page does not upload data, approve a batch, create a Lead, or start outreach.
          </p>
        </div>
        <div className="text-right text-sm text-gray-400">
          <p>{actor.email}</p>
          <p>{label(actor.role)}</p>
          <Link className="mt-2 inline-block text-brand-300 hover:text-brand-200" href="/admin">Back to admin</Link>
        </div>
      </div>

      <section className="mt-10 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        <div className="border-b border-ink-700 px-6 py-4">
          <h2 className="font-semibold text-white">Recent batches</h2>
          <p className="mt-1 text-sm text-gray-400">Showing the latest 25 batches. Payload content, customer contact data, and secrets are intentionally excluded.</p>
        </div>

        {batches.length === 0 ? (
          <p className="px-6 py-10 text-sm text-gray-400">No lead-import batches have been created.</p>
        ) : (
          <div className="divide-y divide-ink-700">
            {batches.map((batch) => {
              const exceptionRows = batch.rows.filter((row) => !["VALID", "APPROVED", "IMPORTED", "RECEIVED"].includes(row.status));
              return (
                <article className="px-6 py-6" key={batch.id}>
                  <div className="flex flex-col justify-between gap-4 lg:flex-row">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-white">{batch.localRunId}</h3>
                        <span className="rounded-full border border-ink-700 px-2 py-0.5 text-xs text-gray-300">{label(batch.status)}</span>
                        <Link className="rounded-md border border-ink-700 px-2 py-1 text-xs text-brand-300 hover:border-brand-500 hover:text-brand-200" href={`/admin/lead-imports/${batch.id}`}>
                          Review batch
                        </Link>
                      </div>
                      <p className="mt-2 text-sm text-gray-400">Batch ID: <span className="font-mono text-xs">{batch.id}</span></p>
                      <p className="mt-1 text-sm text-gray-400">Created {pacific(batch.createdAt)} PT · Updated {pacific(batch.updatedAt)} PT</p>
                      <p className="mt-1 text-sm text-gray-400">Approval: {batch.approvalReference ?? "Not recorded"} · Submitted: {pacific(batch.submittedAt)} PT · Completed: {pacific(batch.completedAt)} PT</p>
                      {batch.failureReason && <p className="mt-3 rounded-lg border border-red-900/70 bg-red-950/30 px-3 py-2 text-sm text-red-200">Reconciliation note: {batch.failureReason}</p>}
                    </div>
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-gray-300 sm:grid-cols-3">
                      <div><dt className="text-gray-500">Rows</dt><dd>{batch.rowCount}</dd></div>
                      <div><dt className="text-gray-500">Inserted</dt><dd>{batch.insertedCount ?? 0}</dd></div>
                      <div><dt className="text-gray-500">Duplicates</dt><dd>{batch.duplicateCount ?? 0}</dd></div>
                      <div><dt className="text-gray-500">Suppressed</dt><dd>{batch.suppressedCount ?? 0}</dd></div>
                      <div><dt className="text-gray-500">Rejected</dt><dd>{batch.rejectedCount ?? 0}</dd></div>
                      <div><dt className="text-gray-500">Exceptions</dt><dd>{exceptionRows.length}</dd></div>
                    </dl>
                  </div>

                  {exceptionRows.length > 0 && (
                    <div className="mt-5 overflow-x-auto rounded-xl border border-ink-700">
                      <table className="min-w-full divide-y divide-ink-700 text-left text-sm">
                        <thead className="bg-ink-950/60 text-xs uppercase tracking-wide text-gray-500">
                          <tr><th className="px-4 py-3">Row</th><th className="px-4 py-3">Outcome</th><th className="px-4 py-3">Evidence</th><th className="px-4 py-3">Related record</th></tr>
                        </thead>
                        <tbody className="divide-y divide-ink-700">
                          {exceptionRows.map((row) => {
                            const rowIssues = issues(row.issues);
                            return (
                              <tr key={row.id} className="text-gray-300">
                                <td className="px-4 py-3 font-mono text-xs">{row.rowNumber}</td>
                                <td className="px-4 py-3">{label(row.status)}</td>
                                <td className="px-4 py-3 text-gray-400">{rowIssues.length ? rowIssues.join(" ") : "No additional evidence recorded."}</td>
                                <td className="px-4 py-3 font-mono text-xs text-gray-400">{row.createdLeadId ?? row.existingLeadId ?? "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
