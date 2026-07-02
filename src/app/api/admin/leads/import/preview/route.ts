import { NextRequest, NextResponse } from "next/server";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { requireFeature } from "@/lib/features";
import { previewLeadImport } from "@/lib/lead-import-preview";

export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !Array.isArray((body as { rows?: unknown }).rows)) {
    return NextResponse.json({ error: "Provide an object containing a rows array." }, { status: 422 });
  }

  try {
    requireFeature("leads");
    await requireRole(ADMIN_ROLES);
    const rows = (body as { rows: unknown[] }).rows;
    if (rows.length === 0) return NextResponse.json({ error: "Provide at least one import row." }, { status: 422 });
    if (rows.length > 500) return NextResponse.json({ error: "Import batches are limited to 500 rows." }, { status: 422 });
    return NextResponse.json({ rows: previewLeadImport(rows) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Lead preview failed." }, { status: 400 });
  }
}
