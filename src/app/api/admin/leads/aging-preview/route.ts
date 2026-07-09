import { NextRequest, NextResponse } from "next/server";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { runLeadAgingSweep } from "@/lib/lead-aging-jobs";
import { features } from "@/lib/features";

export const dynamic = "force-dynamic";

function readLimit(request: NextRequest) {
  const value = Number(request.nextUrl.searchParams.get("limit") ?? "");
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export async function GET(request: NextRequest) {
  if (!features.leads) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const actor = await requireRole(ADMIN_ROLES);
  const result = await runLeadAgingSweep({ dryRun: true, limit: readLimit(request) });
  return NextResponse.json(
    {
      ...result,
      reportType: "lead-aging-preview",
      generatedByRole: actor.role,
      generatedAt: new Date().toISOString(),
      mutationPerformed: false,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
