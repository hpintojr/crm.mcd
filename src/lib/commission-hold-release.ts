import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { requireFeature } from "@/lib/features";

const releaseSchema = z.object({
  holdId: z.string().trim().min(8).max(128),
  note: z.string().trim().min(3).max(2_000),
});

type HoldRow = { id: string; ledgerEntryId: string | null };

export async function releaseCommissionHold(input: z.input<typeof releaseSchema>) {
  requireFeature("commissions");
  const actor = await requireRole(ADMIN_ROLES);
  const parsed = releaseSchema.parse(input);
  const holds = await db.$queryRaw<HoldRow[]>`
    SELECT "id", "ledgerEntryId" FROM "CommissionHold" WHERE "id" = ${parsed.holdId} AND "active" = true
  `;
  const hold = holds[0];
  if (!hold) throw new Error("Active commission hold not found.");
  const now = new Date();

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "CommissionHold"
      SET "active" = false, "releasedById" = ${actor.id}, "releasedAt" = ${now}, "releaseNote" = ${parsed.note}, "updatedAt" = ${now}
      WHERE "id" = ${hold.id} AND "active" = true
    `;
    if (hold.ledgerEntryId) {
      await tx.$executeRaw`
        UPDATE "CommissionLedgerEntry"
        SET "status" = 'PENDING_VERIFICATION'::"CommissionLedgerEntryStatus", "holdReason" = NULL, "eligibleAt" = NULL, "updatedAt" = ${now}
        WHERE "id" = ${hold.ledgerEntryId}
      `;
    }
    await tx.$executeRaw`
      INSERT INTO "AuditLog" ("id", "actorUserId", "actorRole", "actionType", "entityType", "entityId", "reason", "createdAt")
      VALUES (${randomUUID()}, ${actor.id}, ${actor.role}, 'COMMISSION_LEDGER_HOLD_RELEASED', 'CommissionHold', ${hold.id}, ${parsed.note}, ${now})
    `;
  });

  return { ledgerEntryId: hold.ledgerEntryId };
}
