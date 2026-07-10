import { NextResponse } from "next/server";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { getLeadAcceptanceClosedGates } from "@/lib/lead-acceptance-gates";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireRole(ADMIN_ROLES);
  const gates = await getLeadAcceptanceClosedGates();
  return NextResponse.json(
    {
      ...gates,
      viewedBy: { id: actor.id, role: actor.role },
      safetyBoundary:
        "Read-only closed acceptance gates only. Does not mutate Leads, audit records, feature flags, GHL workflows, imports, exports, commissions, payouts, finance, client onboarding, or business rules.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
