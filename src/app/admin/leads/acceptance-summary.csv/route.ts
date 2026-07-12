import { NextRequest } from "next/server";
import { authenticatedCsvDownload, authenticatedRequestId } from "@/lib/authenticated-json-boundary";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { getLeadAcceptanceOverview } from "@/lib/lead-acceptance-overview";

export const dynamic = "force-dynamic";

type CsvRow = [string, string, string];

function escapeCsv(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function flattenCsv(path: string, value: unknown, rows: CsvRow[]) {
  if (Array.isArray(value)) {
    if (value.length === 0) rows.push([path, "array", "[]"]);
    value.forEach((item, index) => flattenCsv(`${path}.${index}`, item, rows));
    return;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) rows.push([path, "object", "{}"]);
    for (const [key, child] of entries) {
      flattenCsv(`${path}.${key}`, child, rows);
    }
    return;
  }

  rows.push([path, value === null ? "null" : typeof value, value === undefined ? "" : String(value)]);
}

export async function GET(request: NextRequest) {
  const requestId = authenticatedRequestId(request);
  const actor = await requireRole(ADMIN_ROLES);
  const overview = await getLeadAcceptanceOverview();
  const payload = {
    ...overview,
    viewedBy: { role: actor.role },
    safetyBoundary:
      "Read-only acceptance overview CSV export only. Does not mutate Leads, audit records, feature flags, GHL workflows, imports, exports, commissions, payouts, finance, client onboarding, or business rules.",
  };

  const rows: CsvRow[] = [];
  flattenCsv("acceptance_overview", payload, rows);

  const csv = [["path", "type", "value"], ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
  return authenticatedCsvDownload(
    csv,
    `mcd-lead-acceptance-summary-${new Date().toISOString().slice(0, 10)}.csv`,
    requestId,
  );
}
