"use client";

import { useMemo, useState } from "react";
import { calculateFiftyFiftyCommission } from "@/lib/commission-formula";

function cents(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : 0;
}

function dollars(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value / 100);
}

export function CommissionPreviewForm() {
  const [input, setInput] = useState({ collected: "0", wholesale: "0", fee: "0", tax: "0", minimum: "0" });
  const result = useMemo(() => calculateFiftyFiftyCommission({
    collectedCents: cents(input.collected),
    wholesaleCents: cents(input.wholesale),
    processingFeeCents: cents(input.fee),
    taxCents: cents(input.tax),
    minProfitCents: cents(input.minimum),
  }), [input]);

  const field = (key: keyof typeof input, label: string) => <label className="text-sm text-gray-300" key={key}>{label}<input className="mt-1 block w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-gray-100" min="0" onChange={(event) => setInput((current) => ({ ...current, [key]: event.target.value }))} step="0.01" type="number" value={input[key]} /></label>;

  return <><div className="mt-8 grid gap-4 rounded-2xl border border-ink-700 bg-ink-900 p-6 sm:grid-cols-2">{field("collected", "Collected amount")}{field("wholesale", "Wholesale cost")}{field("fee", "Processing fee")}{field("tax", "Tax amount")}{field("minimum", "Minimum profit")}</div><section className="mt-6 grid gap-4 rounded-2xl border border-ink-700 bg-ink-900 p-6 sm:grid-cols-2"><p className="text-gray-300">Collected excluding tax <strong className="ml-2 text-white">{dollars(result.collectedExcludingTaxCents)}</strong></p><p className="text-gray-300">Net commissionable profit <strong className="ml-2 text-white">{dollars(result.netCommissionableProfitCents)}</strong></p><p className="text-gray-300">Agent share <strong className="ml-2 text-emerald-300">{dollars(result.agentShareCents)}</strong></p><p className="text-gray-300">Company share <strong className="ml-2 text-white">{dollars(result.companyShareCents)}</strong></p><p className="text-sm text-gray-500 sm:col-span-2">Minimum-profit requirement: {result.meetsMinimumProfit ? "met" : "not met"}</p></section></>;
}
