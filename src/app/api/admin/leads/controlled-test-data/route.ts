import { NextResponse } from "next/server";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import {
  CONTROLLED_TEST_GHL_EXPORT_BLOCK,
  CONTROLLED_TEST_LEAD_CAMPAIGN,
  CONTROLLED_TEST_LEAD_SOURCE,
  LEAD_CONTROLLED_TEST_ARCHIVED_ACTION,
  LEAD_CONTROLLED_TEST_CREATED_ACTION,
  controlledTestLeadWhere,
} from "@/lib/controlled-test-leads";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!features.leads) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const actor = await requireRole(ADMIN_ROLES);
  const [leads, activeCount, archivedCount, createdAuditCount, archivedAuditCount] = await Promise.all([
    db.lead.findMany({
      where: controlledTestLeadWhere,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        company: true,
        businessPhone: true,
        normalizedPhone: true,
        lifecycle: true,
        pool: true,
        ownerAgentId: true,
        suppressed: true,
        dnc: true,
        source: true,
        sourceReference: true,
        campaignName: true,
        campaignExternalId: true,
        ghlContactId: true,
        ghlOpportunityId: true,
        ghlAppointmentId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.lead.count({ where: { ...controlledTestLeadWhere, suppressed: false, dnc: false } }),
    db.lead.count({ where: { ...controlledTestLeadWhere, suppressed: true } }),
    db.auditLog.count({ where: { actionType: LEAD_CONTROLLED_TEST_CREATED_ACTION, entityType: "Lead" } }),
    db.auditLog.count({ where: { actionType: LEAD_CONTROLLED_TEST_ARCHIVED_ACTION, entityType: "Lead" } }),
  ]);

  return NextResponse.json(
    {
      ok: true,
      reportType: "lead-controlled-test-data",
      generatedAt: new Date().toISOString(),
      generatedByRole: actor.role,
      controlledTestSource: CONTROLLED_TEST_LEAD_SOURCE,
      controlledTestCampaign: CONTROLLED_TEST_LEAD_CAMPAIGN,
      controlledTestCampaignExternalId: CONTROLLED_TEST_GHL_EXPORT_BLOCK,
      counts: {
        total: leads.length,
        activeCount,
        archivedCount,
        createdAuditCount,
        archivedAuditCount,
      },
      safety: {
        schemaMigrationRequired: false,
        ghlExportBlockedByDefault: true,
        usesSyntheticContactData: true,
        doesNotActivateGhlWorkflows: true,
        doesNotChangeFeatureFlags: true,
        doesNotCreateLiveCustomerOrProspectRecords: true,
      },
      leads: leads.map((lead) => ({
        ...lead,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
        activeForAcceptance: !lead.suppressed && !lead.dnc,
        ghlExportBlockedByDefault: true,
        hasAnyGhlIdentifier: Boolean(lead.ghlContactId || lead.ghlOpportunityId || lead.ghlAppointmentId),
      })),
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
