import Link from "next/link";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { getIntegrationHealthSnapshot, type IntegrationHealthState } from "@/lib/integration-health";

export const dynamic = "force-dynamic";

function pacific(value: string | null) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Los_Angeles",
  });
}

function stateLabel(state: IntegrationHealthState) {
  return state.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function stateClass(state: IntegrationHealthState) {
  if (state === "READY") return "border-emerald-700 bg-emerald-950/20 text-emerald-200";
  if (state === "ATTENTION_REQUIRED" || state === "CONFIGURATION_INCOMPLETE") return "border-amber-800 bg-amber-950/20 text-amber-200";
  return "border-red-800 bg-red-950/20 text-red-200";
}

export default async function IntegrationHealthPage() {
  const actor = await requireRole(ADMIN_ROLES);
  const snapshot = await getIntegrationHealthSnapshot();

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12" data-integration-health="aggregate-control-plane">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Integration health control plane</h1>
          <p className="mt-2 max-w-4xl text-gray-400">
            Read-only aggregate health for inbound webhook traffic, unresolved integration failures, and GHL configuration readiness. No payload, event, location, message, reference, or contact details are selected or displayed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/api/admin/integrations/health">JSON API</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/integrations">Integration monitor</Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/project-readiness">Project readiness</Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <Metric label="Health state" value={stateLabel(snapshot.state)} detail={`Snapshot ${snapshot.version}`} alert={snapshot.state !== "READY"} />
        <Metric label="Environment" value={snapshot.ok ? snapshot.deployment.environment : "Unavailable"} detail="Current Vercel runtime" />
        <Metric label="Branch" value={snapshot.ok ? snapshot.deployment.branch : "Unavailable"} detail="Expected main in production" />
        <Metric label="Commit" value={snapshot.ok ? snapshot.deployment.commitShort : "Unavailable"} detail="Current deployed Git SHA" />
      </section>

      {!snapshot.ok ? (
        <section className="mt-8 rounded-2xl border border-red-800 bg-red-950/20 p-6">
          <h2 className="font-semibold text-red-100">Integration health read failed</h2>
          <p className="mt-2 text-sm text-red-100/80">Error class: {snapshot.error}</p>
          <p className="mt-3 text-xs text-red-200/70">{snapshot.safetyBoundary}</p>
        </section>
      ) : (
        <>
          <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-integration-health-metrics="24h">
            <Metric label="Webhook events · 24h" value={String(snapshot.webhooks.total24h)} detail={`${snapshot.trafficState.toLowerCase()} traffic`} />
            <Metric label="Processed · 24h" value={String(snapshot.webhooks.processed24h)} detail="WebhookEvent.status = PROCESSED" />
            <Metric label="Failed · 24h" value={String(snapshot.webhooks.failed24h)} detail="WebhookEvent.status = ERROR" alert={snapshot.webhooks.failed24h > 0} />
            <Metric label="Unresolved errors" value={String(snapshot.errors.unresolvedTotal)} detail={`${snapshot.errors.resolved24h} resolved in 24h`} alert={snapshot.errors.unresolvedTotal > 0} />
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-ink-700 bg-ink-900 p-6" data-integration-health-configuration="ghl">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-white">Configuration readiness</h2>
                  <p className="mt-2 text-sm text-gray-400">Boolean and count signals only. Secret values are never returned.</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${snapshot.configuration.inboundConfigurationReady ? "border-emerald-700 text-emerald-200" : "border-amber-800 text-amber-200"}`}>
                  {snapshot.configuration.inboundConfigurationReady ? "Inbound ready" : "Inbound incomplete"}
                </span>
              </div>
              <Signal label="Webhook secret configured" value={snapshot.configuration.webhookSecretConfigured} />
              <Signal label="Approved locations present" value={snapshot.configuration.approvedLocationCount > 0} detail={`${snapshot.configuration.approvedLocationCount} configured`} />
              <Signal label="Outbound GHL configured" value={snapshot.configuration.outboundConfigurationReady} />
              <Signal label="MiniCRM Lead field configured" value={snapshot.configuration.miniCrmLeadFieldConfigured} />
            </article>

            <article className="rounded-2xl border border-ink-700 bg-ink-900 p-6" data-integration-health-timestamps="latest">
              <h2 className="font-semibold text-white">Latest aggregate activity</h2>
              <Timestamp label="Webhook received" value={snapshot.webhooks.latestReceivedAt} />
              <Timestamp label="Webhook processed" value={snapshot.webhooks.latestProcessedAt} />
              <Timestamp label="Webhook failed" value={snapshot.webhooks.latestFailedAt} alert={Boolean(snapshot.webhooks.latestFailedAt)} />
              <Timestamp label="Unresolved integration error" value={snapshot.errors.latestUnresolvedAt} alert={Boolean(snapshot.errors.latestUnresolvedAt)} />
            </article>
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <CountTable title="Webhook categories · 24h" rows={snapshot.webhooks.byCategory} />
            <CountTable title="Unresolved error categories" rows={snapshot.errors.byCategory} detail={`Sampled ${snapshot.errors.sampledUnresolved} of ${snapshot.errors.unresolvedTotal} unresolved records`} />
          </section>

          <section className="mt-8 rounded-2xl border border-emerald-900 bg-emerald-950/20 p-6" data-integration-health-privacy="aggregate-only">
            <h2 className="font-semibold text-emerald-100">Aggregate-only privacy contract</h2>
            <div className="mt-4 grid gap-2 text-sm text-emerald-100/80 md:grid-cols-2">
              <p>Payloads included: {snapshot.privacy.includesPayloads ? "Yes" : "No"}</p>
              <p>Event or location IDs included: {snapshot.privacy.includesEventIds || snapshot.privacy.includesLocationIds ? "Yes" : "No"}</p>
              <p>Messages or references included: {snapshot.privacy.includesMessages || snapshot.privacy.includesReferences ? "Yes" : "No"}</p>
              <p>Contact data included: {snapshot.privacy.includesContactData ? "Yes" : "No"}</p>
            </div>
          </section>
        </>
      )}

      <section className="mt-8 rounded-2xl border border-amber-900 bg-amber-950/20 p-6">
        <h2 className="font-semibold text-amber-100">Safety boundary</h2>
        <p className="mt-2 text-sm leading-6 text-amber-100/80">{snapshot.safetyBoundary}</p>
        <p className="mt-3 text-xs text-amber-200/70">Viewed by {actor.email}. Generated {pacific(snapshot.generatedAt)} PT.</p>
      </section>
    </main>
  );
}

function Metric({ label, value, detail, alert = false }: { label: string; value: string; detail: string; alert?: boolean }) {
  return <article className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">{label}</p><p className={`mt-2 break-words text-2xl font-semibold ${alert ? "text-amber-200" : "text-white"}`}>{value}</p><p className="mt-2 text-xs text-gray-500">{detail}</p></article>;
}

function Signal({ label, value, detail }: { label: string; value: boolean; detail?: string }) {
  return <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-ink-700 bg-ink-950 px-4 py-3 text-sm"><span className="text-gray-300">{label}{detail ? <span className="ml-2 text-xs text-gray-500">{detail}</span> : null}</span><span className={value ? "text-emerald-200" : "text-amber-200"}>{value ? "Ready" : "Missing"}</span></div>;
}

function Timestamp({ label, value, alert = false }: { label: string; value: string | null; alert?: boolean }) {
  return <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-ink-700 bg-ink-950 px-4 py-3 text-sm"><span className="text-gray-300">{label}</span><span className={alert ? "text-amber-200" : "text-gray-400"}>{pacific(value)} PT</span></div>;
}

function CountTable({ title, rows, detail }: { title: string; rows: Array<{ key: string; count: number }>; detail?: string }) {
  return <article className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900"><div className="border-b border-ink-700 px-6 py-4"><h2 className="font-semibold text-white">{title}</h2>{detail ? <p className="mt-1 text-xs text-gray-500">{detail}</p> : null}</div><div className="divide-y divide-ink-700">{rows.map((row) => <div className="flex items-center justify-between px-6 py-3 text-sm" key={row.key}><span className="capitalize text-gray-300">{row.key}</span><span className="font-mono text-brand-200">{row.count}</span></div>)}</div></article>;
}
