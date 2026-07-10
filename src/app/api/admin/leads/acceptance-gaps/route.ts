import { NextResponse } from "next/server";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { getLeadAcceptanceEvidenceGaps } from "@/lib/lead-acceptance-gaps";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireRole(ADMIN_ROLES);
  const gaps = await getLeadAcceptanceEvidenceGaps();
  return NextResponse.json(
    {
      ...gaps,
      viewedBy: { id: actor.id, role: actor.role },
      safetyBoundary:
        "Read-only acceptance evidence gaps only. Does not mutate Leads, audit records, feature flags, GHL workflows, imports, exports, or business rules.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
