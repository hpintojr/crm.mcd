"use client";

import { useState } from "react";

type Result = { error?: string; rows?: Array<{ rowNumber: number; status: string; issues: string[] }>; inserted?: number; duplicateInDatabase?: number; suppressed?: number; rejected?: number };

const sample = `[
  {
    "company": "TEST — Example Business",
    "businessPhone": "+15555550101",
    "email": "test@example.com",
    "originalSource": "WEB_FORM",
    "intakeMethod": "MANUAL_ENTRY",
    "sourceDetail": "Internal acceptance test"
  }
]`;

export function AdminLeadImportForm() {
  const [payload, setPayload] = useState(sample);
  const [result, setResult] = useState<Result | null>(null);
  const [previewed, setPreviewed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(mode: "preview" | "commit") {
    setResult(null);
    let rows: unknown;
    try { rows = JSON.parse(payload); } catch { setResult({ error: "Enter a valid JSON array." }); return; }
    if (!Array.isArray(rows)) { setResult({ error: "The payload must be a JSON array." }); return; }
    setBusy(true);
    try {
      const response = await fetch(mode === "preview" ? "/api/admin/leads/import/preview" : "/api/admin/leads/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
      const body = await response.json().catch(() => ({ error: "Invalid server response." })) as Result;
      setResult(body);
      setPreviewed(mode === "preview" && response.ok);
    } catch { setResult({ error: "Request failed. Confirm your admin session and try again." }); }
    finally { setBusy(false); }
  }

  return <section className="rounded-2xl border border-ink-700 bg-ink-900 p-6"><h2 className="text-lg font-semibold text-white">Controlled lead import</h2><p className="mt-1 text-sm text-gray-400">Preview a JSON batch first. New records go to admin review and never directly into Open Pool.</p><textarea className="mt-5 min-h-80 w-full rounded-xl border border-ink-700 bg-ink-950 p-4 font-mono text-xs text-gray-100" value={payload} onChange={(event) => { setPayload(event.target.value); setPreviewed(false); }} spellCheck={false} /><div className="mt-4 flex gap-3"><button className="rounded-lg border border-brand-500 px-4 py-2 text-sm text-brand-200" disabled={busy} type="button" onClick={() => run("preview")}>{busy ? "Working…" : "Preview"}</button><button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 disabled:opacity-50" disabled={!previewed || busy} type="button" onClick={() => run("commit")}>Commit reviewed batch</button></div>{result?.error && <p className="mt-4 text-sm text-red-200">{result.error}</p>}{result?.rows && <div className="mt-5 space-y-2">{result.rows.map((row) => <div className="rounded-lg border border-ink-700 p-3 text-sm" key={row.rowNumber}><strong>Row {row.rowNumber}: {row.status}</strong><p className="mt-1 text-gray-400">{row.issues.join(" ") || "Validated."}</p></div>)}</div>}{result?.inserted !== undefined && <p className="mt-4 text-sm text-gray-200">Created {result.inserted}; existing duplicates {result.duplicateInDatabase ?? 0}; suppression matches {result.suppressed ?? 0}; rejected {result.rejected ?? 0}.</p>}</section>;
}
