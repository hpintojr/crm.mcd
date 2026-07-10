import { NextResponse } from "next/server";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { getLeadAcceptanceEvidenceMatrix } from "@/lib/lead-acceptance-matrix";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireRole(ADMIN_ROLES);
  const matrix = await getLeadAcceptanceEvidenceMatrix();
  return NextResponse.json(
    {
      ...matrix,
      viewedBy: { id: actor.id, role: actor.role },
      safetyBoundary:
        "Read-only acceptance evidence matrix only. Does not mutate Leads, audit records, feature flags, GHL workflows, imports, exports, or business rules.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
