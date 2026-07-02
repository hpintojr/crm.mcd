import { revalidatePath } from "next/cache";
import { features } from "@/lib/features";
import { getPortalContext } from "@/lib/portal-context";
import { PortalFeaturePage } from "@/components/portal-feature-page";
import { listAgentServicingAccounts, listOpenServiceCases } from "@/lib/client-servicing";
import { openClientServiceCase } from "@/lib/client-servicing-actions";
import { recordServiceResponse, resolveClientServiceCase } from "@/lib/client-servicing-resolution";

export const dynamic = "force-dynamic";

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function pacific(value: Date | null) {
  return value ? value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" }) : "—";
}

export default async function PortalServicingPage() {
  const { agent, isAdmin } = await getPortalContext();
  if (!features.servicing) {
    return <PortalFeaturePage eyebrow="Client Success" title="Client servicing" description="Service health, client requests, payment issues, renewal events, and escalations will be managed here."><section className="portal-card max-w-3xl"><h2 className="portal-heading text-lg font-semibold">Servicing Health is staged</h2><p className="portal-copy mt-3 text-sm">The workspace is designed around real service triggers. Healthy, current-paying accounts do not lose their servicing owner because no routine quarterly check-in was logged.</p></section></PortalFeaturePage>;
  }
  if (!agent) {
    return <PortalFeaturePage eyebrow="Client Success" title="Client servicing" description="Client service assignments are available to servicing agents."><section className="portal-card max-w-3xl"><p className="portal-copy text-sm">{isAdmin ? "Use the admin servicing workspace to manage client health and ownership." : "Your account is not linked to an active servicing profile."}</p></section></PortalFeaturePage>;
  }

  const [accounts, cases] = await Promise.all([listAgentServicingAccounts(agent.id), listOpenServiceCases(agent.id)]);

  async function openCase(formData: FormData) {
    "use server";
    const dueAt = String(formData.get("dueAt") ?? "");
    await openClientServiceCase({
      clientAccountId: String(formData.get("clientAccountId") ?? ""),
      trigger: String(formData.get("trigger") ?? "CLIENT_REQUEST") as "CLIENT_REQUEST" | "SUPPORT_ISSUE" | "PAYMENT_PROBLEM" | "RENEWAL_EVENT" | "ESCALATION" | "MANUAL_REVIEW",
      priority: String(formData.get("priority") ?? "NORMAL") as "LOW" | "NORMAL" | "HIGH" | "URGENT",
      summary: String(formData.get("summary") ?? ""),
      dueAt: dueAt || undefined,
    });
    revalidatePath("/portal/servicing");
  }

  async function respond(formData: FormData) {
    "use server";
    await recordServiceResponse({
      clientAccountId: String(formData.get("clientAccountId") ?? ""),
      serviceCaseId: String(formData.get("serviceCaseId") ?? "") || undefined,
      note: String(formData.get("note") ?? ""),
    });
    revalidatePath("/portal/servicing");
  }

  async function resolve(formData: FormData) {
    "use server";
    await resolveClientServiceCase({
      clientAccountId: String(formData.get("clientAccountId") ?? ""),
      serviceCaseId: String(formData.get("serviceCaseId") ?? ""),
      resolution: String(formData.get("resolution") ?? ""),
    });
    revalidatePath("/portal/servicing");
  }

  return <PortalFeaturePage eyebrow="Client Success" title="Client servicing" description="Respond to client requests, support needs, payment issues, renewals, and escalations. Quiet healthy accounts do not require routine activity to remain assigned.">
    <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]"><section className="portal-card p-0"><div className="border-b px-6 py-4 portal-border"><h2 className="portal-heading font-semibold">My client accounts</h2><p className="portal-copy mt-1 text-sm">Only records currently assigned to you are shown.</p></div>{accounts.length === 0 ? <p className="portal-copy px-6 py-10 text-sm">No client accounts are assigned to you.</p> : <div>{accounts.map((account) => <article className="border-b px-6 py-5 last:border-b-0 portal-border" key={account.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="portal-heading font-medium">{account.clientName}</p><p className="portal-copy mt-1 text-sm">{account.packageCode} · {label(account.healthStatus)} · {account.currentOnPayments ? "Current" : "Payment issue"}</p><p className="portal-copy mt-1 text-xs">Open cases: {account.openCaseCount} · Last request: {pacific(account.lastClientRequestAt)} · Last response: {pacific(account.lastSupportResponseAt)}</p></div><span className="rounded-full border px-2 py-1 text-xs portal-border">{label(account.status)}</span></div><form action={openCase} className="mt-4 grid gap-2 lg:grid-cols-[auto_auto_1fr_auto]"><input name="clientAccountId" type="hidden" value={account.id} /><select className="rounded-lg border bg-transparent px-2 py-2 text-sm portal-border" name="trigger" defaultValue="CLIENT_REQUEST"><option value="CLIENT_REQUEST">Client request</option><option value="SUPPORT_ISSUE">Support issue</option><option value="PAYMENT_PROBLEM">Payment problem</option><option value="RENEWAL_EVENT">Renewal event</option><option value="ESCALATION">Escalation</option><option value="MANUAL_REVIEW">Manual review</option></select><select className="rounded-lg border bg-transparent px-2 py-2 text-sm portal-border" name="priority" defaultValue="NORMAL"><option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select><input className="min-w-0 rounded-lg border bg-transparent px-3 py-2 text-sm portal-border" name="summary" placeholder="What happened and what is needed next?" required /><button className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-ink-950" type="submit">Open case</button></form></article>)}</div>}</section>
      <section className="portal-card p-0"><div className="border-b px-6 py-4 portal-border"><h2 className="portal-heading font-semibold">My open service cases</h2><p className="portal-copy mt-1 text-sm">Document the response and resolution for each triggered need.</p></div>{cases.length === 0 ? <p className="portal-copy px-6 py-10 text-sm">No open service cases are assigned to you.</p> : <div>{cases.map((serviceCase) => <article className="border-b px-6 py-5 last:border-b-0 portal-border" key={serviceCase.id}><div className="flex flex-wrap justify-between gap-3"><div><p className="portal-heading font-medium">{serviceCase.clientName}</p><p className="portal-copy mt-1 text-sm">{label(serviceCase.trigger)} · {label(serviceCase.priority)} · {label(serviceCase.status)}</p><p className="portal-copy mt-2 text-sm">{serviceCase.summary}</p></div><p className="portal-copy text-xs">Due {pacific(serviceCase.dueAt)}</p></div><form action={respond} className="mt-4 grid grid-cols-[1fr_auto] gap-2"><input name="clientAccountId" type="hidden" value={serviceCase.clientAccountId} /><input name="serviceCaseId" type="hidden" value={serviceCase.id} /><input className="min-w-0 rounded-lg border bg-transparent px-3 py-2 text-sm portal-border" name="note" placeholder="Document your response" required /><button className="rounded-lg border px-3 py-2 text-sm portal-border" type="submit">Log response</button></form><form action={resolve} className="mt-2 grid grid-cols-[1fr_auto] gap-2"><input name="clientAccountId" type="hidden" value={serviceCase.clientAccountId} /><input name="serviceCaseId" type="hidden" value={serviceCase.id} /><input className="min-w-0 rounded-lg border bg-transparent px-3 py-2 text-sm portal-border" name="resolution" placeholder="Resolution and result" required /><button className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-ink-950" type="submit">Resolve</button></form></article>)}</div>}</section></section>
  </PortalFeaturePage>;
}
