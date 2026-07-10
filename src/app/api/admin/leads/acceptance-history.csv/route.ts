import { NextResponse } from "next/server";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import {
  LEAD_PRODUCTION_ACCEPTANCE_ACTION,
  LEAD_PRODUCTION_ACCEPTANCE_ENTITY,
  LEAD_PRODUCTION_ACCEPTANCE_PHASE,
  readLeadProductionAcceptanceMetadata,
  readLeadProductionAcceptanceOutcome,
} from "@/lib/lead-production-acceptance";
import { acceptanceRunbookHref } from "@/lib/acceptance-runbook-links";

export const dynamic = "force-dynamic";

function escapeCsv(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  const actor = await requireRole(ADMIN_ROLES);
  const records = await db.auditLog.findMany({
    where: {
      actionType: LEAD_PRODUCTION_ACCEPTANCE_ACTION,
      entityType: LEAD_PRODUCTION_ACCEPTANCE_ENTITY,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const header = [
    "recorded_at",
    "reviewer_role",
    "reviewer_user_id",
    "step_id",
    "step_title",
    "outcome",
    "note",
    "phase",
    "status_baseline_commit",
    "runbook_href",
  ];
  const rows = records.map((record) => {
    const metadata = readLeadProductionAcceptanceMetadata(record.metadata);
    const stepId = metadata.stepId || record.entityId || "";
    return [
      record.createdAt.toISOString(),
      record.actorRole || "System",
      record.actorUserId || "",
      stepId,
      metadata.stepTitle || record.entityId || "Acceptance step",
      readLeadProductionAcceptanceOutcome(record.metadata) || "UNKNOWN",
      record.reason || "",
      metadata.phase || LEAD_PRODUCTION_ACCEPTANCE_PHASE,
      metadata.statusBaselineCommit || metadata.expectedCommit || "",
      acceptanceRunbookHref(stepId),
    ];
  });

  await db.auditLog.create({
    data: {
      actorUserId: actor.id,
      actorRole: actor.role,
      actionType: "LEAD_PRODUCTION_ACCEPTANCE_HISTORY_EXPORT_CREATED",
      entityType: "LeadProductionAcceptanceHistory",
      reason: "Lead production acceptance history CSV export created.",
      metadata: { rows: rows.length, phase: LEAD_PRODUCTION_ACCEPTANCE_PHASE, sourceLimit: 200 },
    },
  });

  const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mcd-lead-acceptance-history-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
