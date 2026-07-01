import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["OWNER", "SUPER_ADMIN", "COMPLIANCE_MANAGER", "FINANCE_MANAGER"] as const;

function escapeCsv(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireRole([...ADMIN_ROLES]);
  const entries = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10_000 });
  const lines = [
    ["timestamp", "actor_user_id", "actor_role", "action_type", "entity_type", "entity_id", "reason", "ip_address", "metadata"].join(","),
    ...entries.map((entry) => [
      entry.createdAt.toISOString(),
      entry.actorUserId,
      entry.actorRole,
      entry.actionType,
      entry.entityType,
      entry.entityId,
      entry.reason,
      entry.ipAddress,
      entry.metadata ? JSON.stringify(entry.metadata) : "",
    ].map(escapeCsv).join(",")),
  ];
  await db.auditLog.create({
    data: {
      actorUserId: actor.id,
      actorRole: actor.role,
      actionType: "AUDIT_EXPORT_CREATED",
      entityType: "AuditLog",
      metadata: { rows: entries.length },
    },
  });
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mcd-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
