import { NextResponse } from "next/server";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { getLeadAcceptanceHandoffPacket } from "@/lib/lead-acceptance-handoff";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireRole(ADMIN_ROLES);
  const packet = await getLeadAcceptanceHandoffPacket();
  return NextResponse.json(
    {
      ...packet,
      viewedBy: { id: actor.id, role: actor.role },
      safetyBoundary:
        "Read-only acceptance handoff packet only. Does not mutate Leads, audit records, feature flags, GHL workflows, imports, exports, or business rules.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
