import Link from "next/link";
import { notFound } from "next/navigation";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";

export const dynamic = "force-dynamic";

type Tone = "text-emerald-200" | "text-amber-200" | "text-brand-200" | "text-gray-200" | "text-red-200";

const EXPECTED_GUARD_LINES = [
  "Lead flow alignment guard passed.",
  "Owner decision prep guard passed.",
  "Deferred acceptance runbook guard passed.",
  "Acceptance summary CSV guard passed.",
  "Print runbook guard passed.",
  "Controlled test data history guard passed.",
  "Acceptance diff guard passed.",
  "Overview deferred summary guard passed.",
];

function envValue(v: string | null | undefined): { display: string; present: boolean } {
  if (v && v.length > 0) return { display: v, present: true };
  return { display: "Not exposed in this runtime", present: false };
}

function environmentTone(env: string): Tone {
  if (env === "production") return "text-emerald-200";
  if (env === "preview") return "text-amber-200";
  if (env === "development") return "text-brand-200";
  return "text-gray-200";
}

export default async function LeadDeploymentVerificationPage() {
  if (!features.leads) notFound();
  const actor = await requireRole(ADMIN_ROLES);

  const environment = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown";
  const branch = envValue(process.env.VERCEL_GIT_COMMIT_REF);
  const commitSha = envValue(process.env.VERCEL_GIT_COMMIT_SHA);
  const commitMessage = envValue(process.env.VERCEL_GIT_COMMIT_MESSAGE);
  const url = envValue(process.env.VERCEL_URL);
  const region = envValue(process.env.VERCEL_REGION);
  const deploymentId = envValue(process.env.VERCEL_DEPLOYMENT_ID);
  const productionUrl = envValue(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  const branchUrl = envValue(process.env.VERCEL_BRANCH_URL);
  const commitShort = commitSha.present ? commitSha.display.slice(0, 12) : "unknown";

  const rows: Array<{ id: string; label: string; value: string; present: boolean; hint?: string }> = [
    { id: "environment", label: "VERCEL_ENV", value: environment, present: environment !== "unknown", hint: "Should be `production` on crm.mercurycalldesk.com." },
    { id: "commit-sha", label: "VERCEL_GIT_COMMIT_SHA", value: commitSha.display, present: commitSha.present, hint: "Must match the merged squash commit on hpintojr/crm.mcd main." },
    { id: "commit-ref", label: "VERCEL_GIT_COMMIT_REF", value: branch.display, present: branch.present, hint: "Should be `main` for production deployments." },
    { id: "commit-message", label: "VERCEL_GIT_COMMIT_MESSAGE", value: commitMessage.display, present: commitMessage.present, hint: "First line of the merge commit." },
    { id: "deployment-id", label: "VERCEL_DEPLOYMENT_ID", value: deploymentId.display, present: deploymentId.present, hint: "Vercel deployment uid for the current runtime." },
    { id: "url", label: "VERCEL_URL", value: url.display, present: url.present, hint: "Immutable deployment URL (per-lambda hostname)." },
    { id: "production-url", label: "VERCEL_PROJECT_PRODUCTION_URL", value: productionUrl.display, present: productionUrl.present, hint: "Configured production hostname." },
    { id: "branch-url", label: "VERCEL_BRANCH_URL", value: branchUrl.display, present: branchUrl.present, hint: "Latest-alias URL for the current git branch." },
    { id: "region", label: "VERCEL_REGION", value: region.display, present: region.present, hint: "Vercel region serving this lambda." },
  ];

  const envTone = environmentTone(environment);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12" data-deployment-verification="lead-flow">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Deployment verification</h1>
          <p className="mt-2 max-w-4xl text-gray-400">
            Read-only Vercel deployment status snapshot. Confirm environment, branch, commit sha, deployment id, and the expected build-time guard-pass lines before recording live acceptance evidence. This page reads only Vercel-injected runtime environment variables; it does not mutate Leads, audit records, feature flags, GHL workflows, imports, exports, or business rules.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/api/status">Open /api/status</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-overview">Acceptance overview</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-diff">Acceptance diff</Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/leads/testing">Acceptance board</Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <Metric label="Environment" value={environment} detail="VERCEL_ENV or NODE_ENV" tone={envTone} />
        <Metric label="Branch" value={branch.present ? branch.display : "—"} detail="VERCEL_GIT_COMMIT_REF" tone={branch.present ? "text-brand-200" : "text-gray-200"} />
        <Metric label="Commit" value={commitShort} detail="VERCEL_GIT_COMMIT_SHA (12 char)" tone={commitSha.present ? "text-emerald-200" : "text-red-200"} />
        <Metric label="Deployment" value={deploymentId.present ? deploymentId.display : "—"} detail="VERCEL_DEPLOYMENT_ID" tone={deploymentId.present ? "text-brand-200" : "text-gray-200"} />
      </section>

      <section className="mt-6 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-white">Runtime environment variables</h2>
            <p className="mt-2 text-sm leading-6 text-gray-400">
              Values exposed by Vercel at request time. Missing values mean Vercel does not inject that variable in the current runtime; that is expected for local development and for values Vercel intentionally hides from server code.
            </p>
          </div>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/api/status">JSON /api/status</Link>
        </div>
        <div className="mt-5 overflow-hidden rounded-xl border border-ink-700">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-ink-950/60 text-xs uppercase tracking-widest text-gray-400">
              <tr>
                <th className="border-b border-ink-700 px-4 py-3 font-medium">Variable</th>
                <th className="border-b border-ink-700 px-4 py-3 font-medium">Value</th>
                <th className="border-b border-ink-700 px-4 py-3 font-medium">Expectation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700 text-gray-200">
              {rows.map((row) => (
                <tr className="align-top" data-deployment-verification-row={row.id} key={row.id}>
                  <td className="px-4 py-3 font-mono text-xs text-brand-200">{row.label}</td>
                  <td className="break-all px-4 py-3">
                    <span className={row.present ? "font-medium text-white" : "text-gray-500"}>{row.value}</span>
                  </td>
                  <td className="px-4 py-3 text-xs leading-5 text-gray-400">{row.hint}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6" data-deployment-verification-guards="lead-flow">
        <h2 className="font-semibold text-white">Expected guard-pass lines</h2>
        <p className="mt-2 text-sm leading-6 text-gray-400">
          Every production build on Vercel runs the composite `npm run check:lead-flow-alignment` script and emits the following lines to the build log before `next build` starts. If any line is missing after a merge, treat it as a regression and do not proceed with authenticated production acceptance.
        </p>
        <ul className="mt-4 grid gap-2 md:grid-cols-2">
          {EXPECTED_GUARD_LINES.map((line) => (
            <li className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 font-mono text-xs text-emerald-200" data-deployment-verification-guard-line={line} key={line}>
              {line}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 rounded-2xl border border-amber-900 bg-amber-950/20 p-6">
        <h2 className="font-semibold text-amber-100">Safety boundary</h2>
        <p className="mt-2 text-sm leading-6 text-amber-100/80">
          Viewed by {actor.email}. Deployment verification is a read-only operator reference. Hamilton-only authenticated production acceptance and the owner production decision remain outside automation.
        </p>
      </section>
    </main>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: Tone }) {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
      <p className="text-sm text-gray-400">{label}</p>
      <p className={`mt-2 break-all text-xl font-semibold ${tone}`}>{value}</p>
      <p className="mt-2 text-xs text-gray-500">{detail}</p>
    </div>
  );
}
