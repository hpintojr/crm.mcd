import { NextResponse } from "next/server";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { getLeadAcceptanceOverview } from "@/lib/lead-acceptance-overview";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireRole(ADMIN_ROLES);
  const overview = await getLeadAcceptanceOverview();
  return NextResponse.json(
    {
      ...overview,
      viewedBy: { id: actor.id, role: actor.role },
      safetyBoundary:
        "Read-only Lead acceptance overview only. Does not mutate Leads, audit records, feature flags, GHL workflows, imports, exports, commissions, payouts, finance, client onboarding, or business rules.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
