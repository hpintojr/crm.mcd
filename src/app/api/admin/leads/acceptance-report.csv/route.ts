import { NextResponse } from "next/server";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import {
  LEAD_PRODUCTION_ACCEPTANCE_ACTION,
  LEAD_PRODUCTION_ACCEPTANCE_ENTITY,
  LEAD_PRODUCTION_ACCEPTANCE_PHASE,
  LEAD_STATUS_BASELINE_COMMIT,
  leadProductionAcceptanceSteps,
  readLeadProductionAcceptanceMetadata,
  readLeadProductionAcceptanceOutcome,
} from "@/lib/lead-production-acceptance";

export const dynamic = "force-dynamic";

function escapeCsv(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  const actor = await requireRole(ADMIN_ROLES);
  const records = await db.auditLog.findMany({
    where: { actionType: LEAD_PRODUCTION_ACCEPTANCE_ACTION, entityType: LEAD_PRODUCTION_ACCEPTANCE_ENTITY },
    orderBy: { createdAt: "desc" },
    take: 1_000,
  });
  const latest = new Map<string, (typeof records)[number]>();
  for (const record of records) {
    if (record.entityId && !latest.has(record.entityId)) latest.set(record.entityId, record);
  }
  const header = [
    "phase",
    "status_baseline_commit",
    "step_id",
    "step_title",
    "outcome",
    "recorded_at",
    "recorded_by_role",
    "note",
    "evidence_required",
    "href",
    "action",
  ];
  const rows = leadProductionAcceptanceSteps.map((step) => {
    const record = latest.get(step.id) ?? null;
    const metadata = readLeadProductionAcceptanceMetadata(record?.metadata);
    return [
      metadata.phase || LEAD_PRODUCTION_ACCEPTANCE_PHASE,
      metadata.statusBaselineCommit || metadata.expectedCommit || LEAD_STATUS_BASELINE_COMMIT,
      step.id,
      step.title,
      readLeadProductionAcceptanceOutcome(record?.metadata) || "NOT_RECORDED",
      record?.createdAt.toISOString() || "",
      record?.actorRole || "",
      record?.reason || "",
      step.evidence,
      step.href || "",
      step.action || "",
    ];
  });
  await db.auditLog.create({
    data: {
      actorUserId: actor.id,
      actorRole: actor.role,
      actionType: "LEAD_PRODUCTION_ACCEPTANCE_EXPORT_CREATED",
      entityType: "LeadProductionAcceptanceReport",
      reason: "Lead production acceptance CSV export created.",
      metadata: { rows: rows.length, phase: LEAD_PRODUCTION_ACCEPTANCE_PHASE },
    },
  });
  const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mcd-lead-production-acceptance-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
