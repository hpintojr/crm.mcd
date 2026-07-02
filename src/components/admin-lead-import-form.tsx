"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { leadImportAcceptanceSamples, type LeadImportAcceptanceSample } from "@/lib/lead-import-acceptance-samples";

type Result = { error?: string; rows?: Array<{ rowNumber: number; status: string; issues: string[] }>; inserted?: number; duplicateInDatabase?: number; suppressed?: number; rejected?: number };

const headerAliases: Record<string, string> = {
  company: "company", companyname: "company", businessname: "company",
  firstname: "contactFirstName", contactfirstname: "contactFirstName", contactfirst: "contactFirstName",
  lastname: "contactLastName", contactlastname: "contactLastName", contactlast: "contactLastName",
  email: "email", emailaddress: "email",
  phone: "businessPhone", businessphone: "businessPhone", phonenumber: "businessPhone", mobile: "businessPhone",
  website: "website", url: "website", weburl: "website",
  industry: "industry", city: "city", state: "state", country: "country", timezone: "timezone",
  originalsource: "originalSource", source: "originalSource", leadsource: "originalSource",
  sourcedetail: "sourceDetail", sourceurl: "sourceRecordUrl", sourcerecordurl: "sourceRecordUrl",
  intakemethod: "intakeMethod", intake: "intakeMethod",
  campaignname: "campaignName", campaignid: "campaignExternalId", campaignexternalid: "campaignExternalId",
  referrername: "referrerName", referrertype: "referrerType", referrerleadid: "referrerLeadId",
  utmsource: "utmSource", utmmedium: "utmMedium", utmcampaign: "utmCampaign", utmcontent: "utmContent", utmterm: "utmTerm",
};

function serializeSample(sample: LeadImportAcceptanceSample) {
  return JSON.stringify(leadImportAcceptanceSamples[sample], null, 2);
}

function normalizedHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === "," && !quoted) { row.push(cell.trim()); cell = ""; continue; }
    if (char === "\n" && !quoted) { row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; continue; }
    if (char !== "\r") cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (quoted) throw new Error("CSV has an unclosed quoted field.");
  return rows;
}

function csvToRows(text: string) {
  const [headings, ...data] = parseCsv(text);
  if (!headings?.length) throw new Error("CSV is empty.");
  const keys = headings.map((heading) => headerAliases[normalizedHeader(heading)] || heading.trim());
  const required = ["company", "originalSource", "intakeMethod"];
  const missing = required.filter((key) => !keys.includes(key));
  if (missing.length) throw new Error(`CSV is missing required header${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`);
  return data.map((cells) => Object.fromEntries(keys.map((key, index) => [key, cells[index]?.trim() || undefined]).filter(([, value]) => value !== undefined)));
}

export function AdminLeadImportForm() {
  const router = useRouter();
  const [payload, setPayload] = useState(serializeSample("Valid test record"));
  const [result, setResult] = useState<Result | null>(null);
  const [previewed, setPreviewed] = useState(false);
  const [busy, setBusy] = useState(false);

  function loadTemplate(sample: LeadImportAcceptanceSample) {
    setPayload(serializeSample(sample));
    setResult(null);
    setPreviewed(false);
  }

  async function loadFile(file: File | undefined) {
    if (!file) return;
    setResult(null);
    setPreviewed(false);
    try {
      const contents = await file.text();
      if (file.name.toLowerCase().endsWith(".json")) {
        const rows = JSON.parse(contents);
        if (!Array.isArray(rows)) throw new Error("JSON import file must contain an array of rows.");
        setPayload(JSON.stringify(rows, null, 2));
      } else {
        const rows = csvToRows(contents);
        setPayload(JSON.stringify(rows, null, 2));
      }
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : "The file could not be read." });
    }
  }

  async function run(mode: "preview" | "commit") {
    setResult(null);
    let rows: unknown;
    try { rows = JSON.parse(payload); } catch { setResult({ error: "Enter a valid JSON array or upload a valid CSV file." }); return; }
    if (!Array.isArray(rows)) { setResult({ error: "The payload must be a JSON array." }); return; }
    setBusy(true);
    try {
      const response = await fetch(mode === "preview" ? "/api/admin/leads/import/preview" : "/api/admin/leads/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
      const body = await response.json().catch(() => ({ error: "Invalid server response." })) as Result;
      setResult(body);
      setPreviewed(mode === "preview" && response.ok);
      if (mode === "commit" && response.ok) router.refresh();
    } catch { setResult({ error: "Request failed. Confirm your admin session and try again." }); }
    finally { setBusy(false); }
  }

  return <section className="rounded-2xl border border-ink-700 bg-ink-900 p-6"><h2 className="text-lg font-semibold text-white">Controlled lead import</h2><p className="mt-1 text-sm text-gray-400">Upload a CSV or JSON batch, preview it first, then commit only the reviewed batch. New records go to admin review and never directly into Open Pool.</p><label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-ink-700 bg-ink-950 px-4 py-3 text-sm text-gray-300"><span><strong className="text-white">Upload CSV or JSON</strong><span className="mt-1 block text-xs text-gray-500">Required CSV headers: company, originalSource, intakeMethod, plus email and/or businessPhone. Common header names are recognized.</span></span><input accept=".csv,text/csv,.json,application/json" className="max-w-56 text-xs text-gray-400" disabled={busy} type="file" onChange={(event) => void loadFile(event.target.files?.[0])} /></label><div className="mt-4 flex flex-wrap gap-2">{(Object.keys(leadImportAcceptanceSamples) as LeadImportAcceptanceSample[]).map((sample) => <button className="rounded-lg border border-ink-700 px-3 py-2 text-xs text-gray-200" disabled={busy} key={sample} type="button" onClick={() => loadTemplate(sample)}>{sample}</button>)}</div><textarea className="mt-5 min-h-80 w-full rounded-xl border border-ink-700 bg-ink-950 p-4 font-mono text-xs text-gray-100" value={payload} onChange={(event) => { setPayload(event.target.value); setPreviewed(false); }} spellCheck={false} /><div className="mt-4 flex gap-3"><button className="rounded-lg border border-brand-500 px-4 py-2 text-sm text-brand-200" disabled={busy} type="button" onClick={() => run("preview")}>{busy ? "Working…" : "Preview"}</button><button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 disabled:opacity-50" disabled={!previewed || busy} type="button" onClick={() => run("commit")}>Commit reviewed batch</button></div>{result?.error && <p className="mt-4 text-sm text-red-200">{result.error}</p>}{result?.rows && <div className="mt-5 space-y-2">{result.rows.map((row) => <div className="rounded-lg border border-ink-700 p-3 text-sm" key={row.rowNumber}><strong>Row {row.rowNumber}: {row.status}</strong><p className="mt-1 text-gray-400">{row.issues.join(" ") || "Validated."}</p></div>)}</div>}{result?.inserted !== undefined && <p className="mt-4 text-sm text-gray-200">Created {result.inserted}; existing duplicates {result.duplicateInDatabase ?? 0}; suppression matches {result.suppressed ?? 0}; rejected {result.rejected ?? 0}.</p>}</section>;
}
