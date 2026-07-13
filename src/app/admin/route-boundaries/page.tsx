import Link from "next/link";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import {
  getRouteBoundaryRegistrySnapshot,
  type RouteBoundaryClassification,
  type RouteBoundaryPrimitive,
} from "@/lib/route-boundary-registry";

export const dynamic = "force-dynamic";

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function classificationClass(classification: RouteBoundaryClassification) {
  return classification === "APPROVED_EXCEPTION"
    ? "border-emerald-700 bg-emerald-950/20 text-emerald-200"
    : "border-amber-800 bg-amber-950/20 text-amber-200";
}

function primitiveDescription(primitive: RouteBoundaryPrimitive) {
  const descriptions: Record<RouteBoundaryPrimitive, string> = {
    REQUEST_JSON: "Direct request.json() parsing in a route.",
    REQUEST_TEXT: "Direct raw request body read in a route.",
    DIRECT_NEXT_JSON: "Route-local NextResponse.json construction.",
    DIRECT_NEXT_RESPONSE: "Route-local new NextResponse construction.",
    RAW_ERROR_MESSAGE: "A named error message is returned by the route.",
  };
  return descriptions[primitive];
}

export default async function RouteBoundaryRegistryPage() {
  const actor = await requireRole(ADMIN_ROLES);
  const snapshot = getRouteBoundaryRegistrySnapshot();

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12" data-route-boundary-registry="mcd-source-control-plane">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Route boundary registry</h1>
          <p className="mt-2 max-w-4xl text-gray-400">
            Reviewed source-level exceptions for direct route parsing, response construction, and named domain-error messages.
            The build fails when a primitive is added, removed, or changes count without an explicit registry review.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/api/admin/route-boundaries">JSON API</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/project-readiness">Project readiness</Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/operating-status">Operating status</Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <Metric label="Reviewed findings" value={String(snapshot.summary.findingCount)} detail="Exact path + primitive + count entries" />
        <Metric label="Affected routes" value={String(snapshot.summary.routeCount)} detail="Unique route source files" />
        <Metric label="Approved exceptions" value={String(snapshot.summary.approvedExceptionCount)} detail="Reviewed purpose-built boundaries" />
        <Metric label="Frozen debt" value={String(snapshot.summary.frozenExistingCount)} detail="Must not grow; prioritize removal" alert={snapshot.summary.frozenExistingCount > 0} />
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        <div className="border-b border-ink-700 px-6 py-4">
          <h2 className="font-semibold text-white">Reviewed findings</h2>
          <p className="mt-1 text-sm text-gray-400">Version {snapshot.version} · reviewed {snapshot.reviewedAt}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-ink-950/60 text-xs uppercase tracking-widest text-gray-400">
              <tr>
                <th className="border-b border-ink-700 px-4 py-3 font-medium">Route</th>
                <th className="border-b border-ink-700 px-4 py-3 font-medium">Primitive</th>
                <th className="border-b border-ink-700 px-4 py-3 font-medium">Count</th>
                <th className="border-b border-ink-700 px-4 py-3 font-medium">Classification</th>
                <th className="border-b border-ink-700 px-4 py-3 font-medium">Reviewed rationale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700 text-gray-200">
              {snapshot.findings.map((finding) => (
                <tr data-route-boundary-finding={`${finding.path}:${finding.primitive}`} key={`${finding.path}:${finding.primitive}`}>
                  <td className="px-4 py-4 font-mono text-xs text-brand-200">{finding.path}</td>
                  <td className="px-4 py-4">
                    <p className="font-mono text-xs text-white">{finding.primitive}</p>
                    <p className="mt-1 max-w-xs text-xs text-gray-500">{primitiveDescription(finding.primitive)}</p>
                  </td>
                  <td className="px-4 py-4 font-mono text-xs">{finding.count}</td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${classificationClass(finding.classification)}`}>
                      {label(finding.classification)}
                    </span>
                  </td>
                  <td className="max-w-xl px-4 py-4 text-sm leading-6 text-gray-300">{finding.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-amber-900 bg-amber-950/20 p-6">
        <h2 className="font-semibold text-amber-100">Safety boundary</h2>
        <p className="mt-2 text-sm leading-6 text-amber-100/80">{snapshot.safetyBoundary}</p>
        <p className="mt-3 text-xs text-amber-200/70">Viewed by {actor.email}.</p>
      </section>
    </main>
  );
}

function Metric({ label: metricLabel, value, detail, alert = false }: { label: string; value: string; detail: string; alert?: boolean }) {
  return (
    <article className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
      <p className="text-sm text-gray-400">{metricLabel}</p>
      <p className={`mt-2 text-2xl font-semibold ${alert ? "text-amber-200" : "text-white"}`}>{value}</p>
      <p className="mt-2 text-xs text-gray-500">{detail}</p>
    </article>
  );
}
