import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";
import { listCommissionLedgerSummary, listCommissionReviewCandidates } from "@/lib/commission-read-model";
import { applyCommissionLedgerHold, intakeCommissionLedgerEntry, markCommissionLedgerPaymentCleared } from "@/lib/commission-ledger-actions";

export const dynamic = "force-dynamic";

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function money(cents: number | null) {
  if (cents === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default async function CommissionLedgerPage() {
  await requireRole(ADMIN_ROLES);
  if (!features.commissions) {
    return <main className="mx-auto min-h-screen max-w-5xl px-6 py-12"><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">Commission ledger</h1><p className="mt-3 text-gray-400">The ledger is staged behind the Commission feature gate. It does not create a payout instruction or move money.</p><Link className="mt-6 inline-flex rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/commissions">Commission eligibility</Link></main>;
  }

  const [candidates, ledger] = await Promise.all([listCommissionReviewCandidates(), listCommissionLedgerSummary()]);

  async function intake(formData: FormData) {
    "use server";
    await intakeCommissionLedgerEntry({
      clientAccountId: String(formData.get("clientAccountId") ?? ""),
      paymentRef: String(formData.get("paymentRef") ?? ""),
      paymentOccurredAt: String(formData.get("paymentOccurredAt") ?? ""),
      entryType: String(formData.get("entryType") ?? "RECURRING") as "RECURRING" | "SETUP_FEE" | "REFUND_OFFSET" | "CHARGEBACK_HOLD" | "MANUAL_ADJUSTMENT",
      grossCollectedCents: String(formData.get("grossCollectedCents") ?? "0"),
      refundOffsetCents: String(formData.get("refundOffsetCents") ?? "0"),
      commissionableCents: String(formData.get("commissionableCents") ?? "") || undefined,
      proposedAgentShareCents: String(formData.get("proposedAgentShareCents") ?? "") || undefined,
      calculationNote: String(formData.get("calculationNote") ?? "") || undefined,
      earningAgentId: String(formData.get("earningAgentId") ?? "") || undefined,
    });
    revalidatePath("/admin/commissions");
    revalidatePath("/admin/commissions/ledger");
  }

  async function hold(formData: FormData) {
    "use server";
    await applyCommissionLedgerHold({
      ledgerEntryId: String(formData.get("ledgerEntryId") ?? ""),
      reason: String(formData.get("reason") ?? "MANUAL_REVIEW") as "PAYMENT_UNCLEARED" | "REFUND" | "CHARGEBACK" | "MANUAL_REVIEW" | "COMPLIANCE_REVIEW" | "SERVICE_OWNERSHIP" | "TERMINATED",
      note: String(formData.get("note") ?? ""),
    });
    revalidatePath("/admin/commissions");
    revalidatePath("/admin/commissions/ledger");
  }

  async function clear(formData: FormData) {
    "use server";
    await markCommissionLedgerPaymentCleared({ ledgerEntryId: String(formData.get("ledgerEntryId") ?? ""), note: String(formData.get("note") ?? "") });
    revalidatePath("/admin/commissions");
    revalidatePath("/admin/commissions/ledger");
  }

  return <main className="mx-auto min-h-screen max-w-7xl px-6 py-12"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">Commission ledger</h1><p className="mt-2 max-w-4xl text-gray-400">Record payment references for verification, document holds, and mark confirmed clearance. Finance approval and payout execution are intentionally absent.</p></div><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/commissions">Eligibility review</Link></div>
    <section className="mt-8 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]"><form action={intake} className="rounded-2xl border border-ink-700 bg-ink-900 p-6"><h2 className="text-lg font-semibold text-white">Ledger intake</h2><p className="mt-1 text-sm text-gray-400">Every entry starts as pending verification. Values are recorded in cents to avoid rounding ambiguity.</p><div className="mt-5 grid gap-3"><select className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="clientAccountId" required><option value="">Choose client account</option>{candidates.map((candidate) => <option key={candidate.clientAccountId} value={candidate.clientAccountId}>{candidate.clientName} · {candidate.packageCode}</option>)}</select><input className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="paymentRef" placeholder="Internal payment reference" required /><input className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="paymentOccurredAt" type="datetime-local" required /><select className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="entryType"><option value="RECURRING">Recurring</option><option value="SETUP_FEE">Setup fee</option><option value="REFUND_OFFSET">Refund offset</option><option value="CHARGEBACK_HOLD">Chargeback hold</option><option value="MANUAL_ADJUSTMENT">Manual adjustment</option></select><div className="grid grid-cols-2 gap-3"><input className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="grossCollectedCents" inputMode="numeric" placeholder="Gross cents" required /><input className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="refundOffsetCents" inputMode="numeric" placeholder="Refund offset cents" defaultValue="0" /></div><div className="grid grid-cols-2 gap-3"><input className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="commissionableCents" inputMode="numeric" placeholder="Commissionable cents" /><input className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="proposedAgentShareCents" inputMode="numeric" placeholder="Proposed share cents" /></div><input className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="earningAgentId" placeholder="Earning agent ID (optional)" /><textarea className="min-h-20 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="calculationNote" placeholder="Calculation or source note" /><button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950" type="submit">Record pending entry</button></div></form>
      <section className="rounded-2xl border border-ink-700 bg-ink-900 p-6"><h2 className="text-lg font-semibold text-white">Control rules</h2><div className="mt-5 space-y-4 text-sm text-gray-300"><p><strong>Pending verification:</strong> new entries are not eligible just because they were recorded.</p><p><strong>Clearance:</strong> a payment can become eligible only after a current eligibility decision exists and no active hold remains.</p><p><strong>Holds:</strong> a hold overrides readiness until the issue is separately resolved and reviewed.</p><p><strong>Finance boundary:</strong> no action here sends money or authorizes a payout.</p></div></section></section>
    <section className="mt-6 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900"><div className="border-b border-ink-700 px-6 py-4"><h2 className="font-semibold text-white">Recorded ledger entries</h2><p className="mt-1 text-sm text-gray-400">Use payment clearance and holds as audit controls; no payout action is available.</p></div>{ledger.length === 0 ? <p className="px-6 py-10 text-sm text-gray-400">No ledger entries have been recorded.</p> : <div className="divide-y divide-ink-700">{ledger.map((entry) => <article className="grid gap-5 px-6 py-6 xl:grid-cols-[1fr_0.9fr_1.2fr]" key={entry.id}><div><p className="font-medium text-white">{entry.clientName || "Unlinked client"}</p><p className="mt-1 text-sm text-gray-400">{entry.paymentRef} · {label(entry.entryType)}</p><p className="mt-2 text-sm text-gray-300">Collected {money(entry.grossCollectedCents)} · Offset {money(entry.refundOffsetCents)} · Proposed {money(entry.proposedAgentShareCents)}</p><p className="mt-1 text-xs text-gray-500">Status {label(entry.status)} · Holds {entry.activeHoldCount}</p></div><form action={clear} className="grid gap-2"><input name="ledgerEntryId" type="hidden" value={entry.id} /><input className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="note" placeholder="Payment clearance evidence" required /><button className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" type="submit">Record payment cleared</button></form><form action={hold} className="grid gap-2 sm:grid-cols-[auto_1fr_auto]"><input name="ledgerEntryId" type="hidden" value={entry.id} /><select className="rounded-lg border border-ink-700 bg-ink-950 px-2 py-2 text-sm text-gray-100" name="reason"><option value="PAYMENT_UNCLEARED">Payment uncleared</option><option value="REFUND">Refund</option><option value="CHARGEBACK">Chargeback</option><option value="MANUAL_REVIEW">Manual review</option><option value="COMPLIANCE_REVIEW">Compliance review</option><option value="SERVICE_OWNERSHIP">Service ownership</option><option value="TERMINATED">Terminated</option></select><input className="min-w-0 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="note" placeholder="Hold reason and evidence" required /><button className="rounded-lg border border-red-800 px-3 py-2 text-sm text-red-200" type="submit">Apply hold</button></form></article>)}</div>}</section>
  </main>;
}
