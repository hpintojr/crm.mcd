import { NextResponse } from "next/server";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { getLeadAcceptanceOverview } from "@/lib/lead-acceptance-overview";

export const dynamic = "force-dynamic";

function escapeCsv(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function flatten(value: unknown, path: string, rows: string[][]) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      rows.push([path, "[]"]);
      return;
    }
    value.forEach((item, index) => flatten(item, `${path}[${index}]`, rows));
    return;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      rows.push([path, "{}"]);
      return;
    }
    for (const [key, child] of entries) {
      flatten(child, path ? `${path}.${key}` : key, rows);
    }
    return;
  }

  rows.push([path, value === null || value === undefined ? "" : String(value)]);
}

export async function GET() {
  await requireRole(ADMIN_ROLES);
  const overview = await getLeadAcceptanceOverview();
  const rows: string[][] = [];
  flatten(overview, "overview", rows);

  const header = ["path", "value"];
  const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mcd-lead-acceptance-overview-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
      "X-MCD-Safety-Boundary": "read-only-acceptance-overview-csv",
    },
  });
}
