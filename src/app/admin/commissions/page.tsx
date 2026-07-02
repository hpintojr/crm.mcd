import { revalidatePath } from "next/cache";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";
import { listCommissionLedgerSummary, listCommissionProfiles, listCommissionReviewCandidates } from "@/lib/commission-read-model";
import { recordCommissionEligibilityReview, setCommissionProfileStatus } from "@/lib/commission-review-actions";

export const dynamic = "force-dynamic";

function label(value: string | null) {
  return value ? value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase()) : "Not reviewed";
}

function money(cents: number | null) {
  if (cents === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function pacific(value: Date | null) {
  return value ? value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" }) : "—";
}

export default async function CommissionReviewPage() {
  const user = await requireRole(ADMIN_ROLES);
  const enabled = features.commissions;

  if (!enabled) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
        <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Commission eligibility</h1>
        <p className="mt-3 max-w-3xl text-gray-400">Eligibility review is separate from payment execution. This workspace does not release funds or connect to a payment provider.</p>
        <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6">
          <p className="text-sm text-gray-300">Feature status: <strong>Staged and locked</strong></p>
          <ul className="mt-5 space-y-2 text-sm text-gray-300">
            <li>Active servicing ownership is required for active-agent eligibility.</li>
            <li>Retired agents retain existing-client eligibility.</li>
            <li>Terminated agents are not eligible for future entries.</li>
            <li>Uncleared payments, refunds, chargebacks, and manual reviews remain on hold.</li>
            <li>Finance approval and payout execution remain separately disabled.</li>
          </ul>
          <p className="mt-6 text-xs text-gray-500">Admin session: {user.email}</p>
        </section>
      </main>
    );
  }

  const [candidates, ledger, profiles] = await Promise.all([listCommissionReviewCandidates(), listCommissionLedgerSummary(), listCommissionProfiles()]);
  const pendingReviewCount = candidates.filter((candidate) => !candidate.latestDecisionStatus || candidate.latestDecisionStatus === "PENDING").length;
  const heldLedgerCount = ledger.filter((entry) => entry.status === "ON_HOLD" || entry.activeHoldCount > 0).length;

  async function reviewOwner(formData: FormData) {
    "use server";
    await recordCommissionEligibilityReview({
      clientAccountId: String(formData.get("clientAccountId") ?? ""),
      agentId: String(formData.get("agentId") ?? ""),
      note: String(formData.get("note") ?? "") || undefined,
    });
    revalidatePath("/admin/commissions");
  }

  async function updateProfile(formData: FormData) {
    "use server";
    const status = String(formData.get("status") ?? "ACTIVE");
    if (!["ACTIVE", "RETIRED", "TERMINATED", "ON_HOLD"].includes(status)) throw new Error("Invalid commission profile status.");
    const note = String(formData.get("note") ?? "").trim();
    if (status !== "ACTIVE" && note.length < 3) throw new Error("Provide a note for retired, terminated, or hold status.");
    await setCommissionProfileStatus({
      agentId: String(formData.get("agentId") ?? ""),
      status: status as "ACTIVE" | "RETIRED" | "TERMINATED" | "ON_HOLD",
      note: note || undefined,
    });
    revalidatePath("/admin/commissions");
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Commission eligibility</h1>
      <p className="mt-3 max-w-4xl text-gray-400">Review client-service ownership, payment clearance, and holds before a ledger item can advance. This page never initiates a payout.</p>
      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">Client accounts</p><p className="mt-2 text-3xl font-semibold text-white">{candidates.length}</p></div>
        <div className="rounded-xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">Pending review</p><p className="mt-2 text-3xl font-semibold text-amber-200">{pendingReviewCount}</p></div>
        <div className="rounded-xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">Held ledger items</p><p className="mt-2 text-3xl font-semibold text-red-200">{heldLedgerCount}</p></div>
      </section>
      <section className="mt-6 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        <div className="border-b border-ink-700 px-6 py-4"><h2 className="font-semibold text-white">Agent commission profiles</h2><p className="mt-1 text-sm text-gray-400">Profile state defines whether an active agent, retired agent, or terminated agent can be considered during eligibility review.</p></div>
        {profiles.length === 0 ? <p className="px-6 py-10 text-sm text-gray-400">No active, suspended, or offboarded agents are available.</p> : <div className="divide-y divide-ink-700">{profiles.map((profile) => <article className="grid gap-3 px-6 py-5 lg:grid-cols-[1fr_0.7fr_1.5fr] lg:items-center" key={profile.agentId}><div><p className="font-medium text-white">{profile.agentName}</p><p className="mt-1 text-sm text-gray-400">{profile.agentEmail} · Agent {label(profile.agentStatus)}</p><p className="mt-1 text-xs text-gray-500">Last reviewed {pacific(profile.lastReviewedAt)}</p></div><div><p className="text-sm text-gray-300">Profile: {label(profile.commissionProfileStatus)}</p><p className="mt-1 text-xs text-gray-500">{profile.reviewNote || "No profile note"}</p></div><form action={updateProfile} className="grid gap-2 sm:grid-cols-[auto_1fr_auto]"><input name="agentId" type="hidden" value={profile.agentId} /><select className="rounded-lg border border-ink-700 bg-ink-950 px-2 py-2 text-sm text-gray-100" name="status" defaultValue={profile.commissionProfileStatus || "ACTIVE"}><option value="ACTIVE">Active</option><option value="RETIRED">Retired</option><option value="ON_HOLD">On hold</option><option value="TERMINATED">Terminated</option></select><input className="min-w-0 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="note" placeholder="Required for retired, hold, or terminated" /><button className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" type="submit">Save profile</button></form></article>)}</div>}
      </section>
      <section className="mt-6 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        <div className="border-b border-ink-700 px-6 py-4"><h2 className="font-semibold text-white">Eligibility review queue</h2><p className="mt-1 text-sm text-gray-400">The active service owner, retirement status, payment standing, and latest decision are shown together.</p></div>
        {candidates.length === 0 ? <p className="px-6 py-10 text-sm text-gray-400">No client accounts are available for commission review.</p> : <div className="divide-y divide-ink-700">{candidates.map((candidate) => <article className="grid gap-3 px-6 py-5 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-center" key={candidate.clientAccountId}><div><p className="font-medium text-white">{candidate.clientName}</p><p className="mt-1 text-sm text-gray-400">{candidate.packageCode} · {candidate.currentOnPayments ? "Current" : "Payment issue"}</p></div><div><p className="text-sm text-gray-300">Service owner: {candidate.ownerName || "House / unassigned"}</p><p className="mt-1 text-xs text-gray-500">Account: {label(candidate.accountStatus)} · Profile: {label(candidate.profileStatus)}</p></div><div><p className="text-sm text-gray-300">Decision: {label(candidate.latestDecisionStatus)}</p><p className="mt-1 text-xs text-gray-500">{label(candidate.latestDecisionReason)} · {pacific(candidate.latestDecisionAt)}</p></div>{candidate.accountOwnerAgentId ? <form action={reviewOwner} className="grid gap-2"><input name="clientAccountId" type="hidden" value={candidate.clientAccountId} /><input name="agentId" type="hidden" value={candidate.accountOwnerAgentId} /><input className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-xs text-gray-100" name="note" placeholder="Review note (optional)" /><button className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" type="submit">Review owner</button></form> : <span className="justify-self-start rounded-full border border-ink-700 px-3 py-1 text-xs text-gray-500">No servicing owner</span>}</article>)}</div>}
      </section>
      <section className="mt-6 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        <div className="border-b border-ink-700 px-6 py-4"><h2 className="font-semibold text-white">Ledger review</h2><p className="mt-1 text-sm text-gray-400">Amounts are review records only. Finance approval and payout execution remain outside this workspace.</p></div>
        {ledger.length === 0 ? <p className="px-6 py-10 text-sm text-gray-400">No commission ledger entries have been recorded.</p> : <div className="divide-y divide-ink-700">{ledger.map((entry) => <article className="grid gap-3 px-6 py-5 lg:grid-cols-[1.2fr_0.9fr_0.8fr_0.8fr] lg:items-center" key={entry.id}><div><p className="font-medium text-white">{entry.clientName || "Unlinked entry"}</p><p className="mt-1 text-sm text-gray-400">{entry.paymentRef} · {label(entry.entryType)}</p></div><div><p className="text-sm text-gray-300">Collected {money(entry.grossCollectedCents)}</p><p className="mt-1 text-xs text-gray-500">Offset {money(entry.refundOffsetCents)} · Proposed {money(entry.proposedAgentShareCents)}</p></div><div><p className="text-sm text-gray-300">{label(entry.status)}</p><p className="mt-1 text-xs text-gray-500">Holds: {entry.activeHoldCount}</p></div><div className="text-xs text-gray-500">Payment {pacific(entry.paymentOccurredAt)}<br />Cleared {pacific(entry.clearedAt)}</div></article>)}</div>}
      </section>
    </main>
  );
}
