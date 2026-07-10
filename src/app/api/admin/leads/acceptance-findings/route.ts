import { NextResponse } from "next/server";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import {
  LEAD_ACCEPTANCE_FINDINGS_CATALOG_VERSION,
  LEAD_ACCEPTANCE_FINDINGS_LATEST_PRODUCTION_COMMIT,
  leadAcceptanceFindingCounts,
  leadAcceptanceFindings,
} from "@/lib/lead-acceptance-findings";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireRole(ADMIN_ROLES);
  return NextResponse.json(
    {
      ok: true,
      catalogVersion: LEAD_ACCEPTANCE_FINDINGS_CATALOG_VERSION,
      latestProductionCommit: LEAD_ACCEPTANCE_FINDINGS_LATEST_PRODUCTION_COMMIT,
      counts: leadAcceptanceFindingCounts(),
      findings: leadAcceptanceFindings,
      viewedBy: { id: actor.id, role: actor.role },
      safetyBoundary:
        "Read-only findings catalog only. Does not mutate Leads, audit records, feature flags, GHL workflows, imports, exports, or business rules.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
