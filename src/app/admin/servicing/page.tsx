import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { createClientAccount, openClientServiceCase } from "@/lib/client-servicing-actions";
import { recordAgentContinuesService, transferClientServiceToHouse } from "@/lib/client-servicing-resolution";
import { listAdminServicingAccounts, listOpenServiceCases } from "@/lib/client-servicing";

export const dynamic = "force-dynamic";

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function pacific(value: Date | null) {
  return value ? value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" }) : "—";
}

export default async function AdminServicingPage() {
  const user = await requireRole(ADMIN_ROLES);
  if (!features.servicing) {
    return <main className="mx-auto min-h-screen max-w-5xl px-6 py-12"><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">Client Servicing Health</h1><p className="mt-3 max-w-3xl text-gray-400">The servicing workspace is deployed behind its feature gate. It will be enabled only after the production schema is approved and controlled tests are complete.</p><div className="mt-6 rounded-xl border border-ink-700 bg-ink-900 p-5 text-sm text-gray-300">Healthy, current-paying clients will not be reassigned merely because there is no routine quarterly check-in.</div></main>;
  }

  const [accounts, cases, agents] = await Promise.all([
    listAdminServicingAccounts(),
    listOpenServiceCases(),
    db.agent.findMany({ where: { status: "ACTIVE" }, orderBy: [{ preferredName: "asc" }, { legalName: "asc" }], select: { id: true, preferredName: true, legalName: true, personalEmail: true } }),
  ]);

  async function createAccount(formData: FormData) {
    "use server";
    await createClientAccount({
      clientName: String(formData.get("clientName") ?? ""),
      packageCode: String(formData.get("packageCode") ?? ""),
      leadId: String(formData.get("leadId") ?? "") || undefined,
      ghlLocationId: String(formData.get("ghlLocationId") ?? "") || undefined,
      ghlContactId: String(formData.get("ghlContactId") ?? "") || undefined,
      accountOwnerAgentId: String(formData.get("accountOwnerAgentId") ?? "") || undefined,
      originatingAgentId: String(formData.get("originatingAgentId") ?? "") || undefined,
    });
    revalidatePath("/admin/servicing");
  }

  async function openCase(formData: FormData) {
    "use server";
    const dueAt = String(formData.get("dueAt") ?? "");
    await openClientServiceCase({
      clientAccountId: String(formData.get("clientAccountId") ?? ""),
      trigger: String(formData.get("trigger") ?? "MANUAL_REVIEW") as "CLIENT_REQUEST" | "SUPPORT_ISSUE" | "PAYMENT_PROBLEM" | "RENEWAL_EVENT" | "ESCALATION" | "MANUAL_REVIEW",
      priority: String(formData.get("priority") ?? "NORMAL") as "LOW" | "NORMAL" | "HIGH" | "URGENT",
      summary: String(formData.get("summary") ?? ""),
      dueAt: dueAt || undefined,
      assignedAgentId: String(formData.get("assignedAgentId") ?? "") || undefined,
    });
    revalidatePath("/admin/servicing");
    revalidatePath("/portal/servicing");
  }

  async function retain(formData: FormData) {
    "use server";
    await recordAgentContinuesService({ clientAccountId: String(formData.get("clientAccountId") ?? ""), note: String(formData.get("note") ?? "") });
    revalidatePath("/admin/servicing");
  }

  async function transferToHouse(formData: FormData) {
    "use server";
    await transferClientServiceToHouse({
      clientAccountId: String(formData.get("clientAccountId") ?? ""),
      reason: String(formData.get("reason") ?? "HOUSE_REVIEW") as "AGENT_DECLINES_SERVICE" | "TERMINATED" | "MANAGER_REASSIGNMENT" | "HOUSE_REVIEW",
      note: String(formData.get("note") ?? ""),
    });
    revalidatePath("/admin/servicing");
    revalidatePath("/portal/servicing");
  }

  return <main className="mx-auto min-h-screen max-w-7xl px-6 py-12"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">Client Servicing Health</h1><p className="mt-2 max-w-4xl text-gray-400">Work only on triggered client needs: requests, support issues, payment problems, renewals, and escalations. A healthy account does not require a routine quarterly check-in to remain with its servicing agent.</p></div><div className="flex items-center gap-3"><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/servicing/onboarding">Client onboarding queue</Link><p className="text-sm text-gray-500">Signed in as {user.email}</p></div></div>
    <section className="mt-8 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]"><form action={createAccount} className="rounded-2xl border border-ink-700 bg-ink-900 p-6"><h2 className="text-lg font-semibold text-white">Create client account</h2><p className="mt-1 text-sm text-gray-400">Create the service record after a client is won and launched. This does not create a commission or payout record.</p><div className="mt-5 grid gap-3"><input className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="clientName" placeholder="Client company name" required /><input className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="packageCode" placeholder="Package code" required /><select className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="accountOwnerAgentId" defaultValue=""><option value="">Assign later / House review</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.preferredName || agent.legalName} · {agent.personalEmail}</option>)}</select><select className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="originatingAgentId" defaultValue=""><option value="">Originating agent not recorded</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.preferredName || agent.legalName} · {agent.personalEmail}</option>)}</select><input className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="ghlLocationId" placeholder="GHL location ID (optional)" /><input className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="ghlContactId" placeholder="GHL contact ID (optional)" /><button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950" type="submit">Create service account</button></div></form>
      <section className="rounded-2xl border border-ink-700 bg-ink-900 p-6"><h2 className="text-lg font-semibold text-white">Open service cases</h2><p className="mt-1 text-sm text-gray-400">These are triggered actions, not cadence obligations.</p>{cases.length === 0 ? <p className="mt-5 text-sm text-gray-400">No open service cases.</p> : <div className="mt-5 space-y-3">{cases.map((serviceCase) => <article className="rounded-xl border border-ink-700 bg-ink-950/40 p-4" key={serviceCase.id}><div className="flex flex-wrap justify-between gap-3"><div><p className="font-medium text-white">{serviceCase.clientName}</p><p className="mt-1 text-sm text-gray-400">{label(serviceCase.trigger)} · {label(serviceCase.priority)} · {label(serviceCase.status)}</p><p className="mt-2 text-sm text-gray-300">{serviceCase.summary}</p></div><p className="text-xs text-gray-500">Due {pacific(serviceCase.dueAt)}</p></div></article>)}</div>}</section></section>
    <section className="mt-6 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900"><div className="border-b border-ink-700 px-6 py-4"><h2 className="font-semibold text-white">Client health and ownership</h2><p className="mt-1 text-sm text-gray-400">No account is automatically reassigned because time passed without routine activity.</p></div>{accounts.length === 0 ? <p className="px-6 py-10 text-sm text-gray-400">No client accounts have been created yet.</p> : <div className="divide-y divide-ink-700">{accounts.map((account) => <article className="px-6 py-6" key={account.id}><div className="grid gap-5 xl:grid-cols-[1fr_1fr]"><div><div className="flex flex-wrap items-center gap-2"><Link className="font-semibold text-white hover:text-brand-200" href={`/admin/servicing/${account.id}`}>{account.clientName}</Link><span className="rounded-full border border-ink-700 px-2 py-1 text-xs text-gray-300">{label(account.healthStatus)}</span><span className="rounded-full border border-ink-700 px-2 py-1 text-xs text-gray-300">{account.currentOnPayments ? "Current" : "Payment issue"}</span></div><p className="mt-1 text-sm text-gray-400">{account.packageCode} · Servicing owner: {account.ownerName || "House / unassigned"}</p><p className="mt-2 text-xs text-gray-500">Open service cases: {account.openCaseCount} · Last request: {pacific(account.lastClientRequestAt)} · Last resolution: {pacific(account.lastResolvedAt)}</p></div><div className="grid gap-2"><form action={openCase} className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_auto_1fr_auto]"><input name="clientAccountId" type="hidden" value={account.id} /><select className="rounded-lg border border-ink-700 bg-ink-950 px-2 py-2 text-sm text-gray-100" name="trigger" defaultValue="CLIENT_REQUEST"><option value="CLIENT_REQUEST">Client request</option><option value="SUPPORT_ISSUE">Support issue</option><option value="PAYMENT_PROBLEM">Payment problem</option><option value="RENEWAL_EVENT">Renewal event</option><option value="ESCALATION">Escalation</option><option value="MANUAL_REVIEW">Manual review</option></select><select className="rounded-lg border border-ink-700 bg-ink-950 px-2 py-2 text-sm text-gray-100" name="priority" defaultValue="NORMAL"><option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select><input className="min-w-0 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="summary" placeholder="Trigger and next action" required /><button className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" type="submit">Open case</button></form>{account.accountOwnerAgentId && <form action={retain} className="grid grid-cols-[1fr_auto] gap-2"><input name="clientAccountId" type="hidden" value={account.id} /><input className="min-w-0 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="note" placeholder="Document continued service responsibility" required /><button className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" type="submit">Retain servicing</button></form>}<form action={transferToHouse} className="grid grid-cols-[auto_1fr_auto] gap-2"><input name="clientAccountId" type="hidden" value={account.id} /><select className="rounded-lg border border-ink-700 bg-ink-950 px-2 py-2 text-sm text-gray-100" name="reason"><option value="AGENT_DECLINES_SERVICE">Agent declines service</option><option value="TERMINATED">Terminated</option><option value="MANAGER_REASSIGNMENT">Manager reassignment</option><option value="HOUSE_REVIEW">House review</option></select><input className="min-w-0 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="note" placeholder="House-transfer reason" required /><button className="rounded-lg border border-amber-700 px-3 py-2 text-sm text-amber-200" type="submit">Transfer to House</button></form></div></div></article>)}</div>}</section>
  </main>;
}
