import Link from "next/link";
import { notFound } from "next/navigation";
import { readOwnerLeadAcquisitionProvenance } from "@/lib/owner-lead-acquisition-provenance";

export const dynamic = "force-dynamic";

function pacific(value: Date) {
  return value.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Los_Angeles",
  });
}

export default async function OwnerLeadAcquisitionPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const provenance = await readOwnerLeadAcquisitionProvenance(batchId);
  if (!provenance) notFound();

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <Link className="text-sm text-brand-300 hover:text-brand-200" href="/admin/lead-imports">Back to import review</Link>
      <section className="mt-6 rounded-2xl border border-amber-800/70 bg-ink-900 p-6">
        <p className="text-sm font-medium uppercase tracking-widest text-amber-300">Owner-only</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Acquisition record</h1>
        <p className="mt-3 text-sm text-gray-400">This record contains opaque internal identifiers only. Commercial identity and purchase records remain outside MiniCRM.</p>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-gray-500">Batch</dt><dd className="mt-1 font-mono text-xs text-gray-200">{provenance.leadImportBatchId}</dd></div>
          <div><dt className="text-gray-500">Source code</dt><dd className="mt-1 text-gray-200">{provenance.sourceCode}</dd></div>
          <div><dt className="text-gray-500">Acquisition reference</dt><dd className="mt-1 text-gray-200">{provenance.acquisitionReference}</dd></div>
          <div><dt className="text-gray-500">Created</dt><dd className="mt-1 text-gray-200">{pacific(provenance.createdAt)} PT</dd></div>
          <div><dt className="text-gray-500">Last updated</dt><dd className="mt-1 text-gray-200">{pacific(provenance.updatedAt)} PT</dd></div>
        </dl>
      </section>
    </main>
  );
}
