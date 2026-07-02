import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { requireFeature } from "@/lib/features";

const launchSchema = z.object({
  clientAccountId: z.string().trim().min(8).max(128),
  note: z.string().trim().min(3).max(2_000),
});

type AccountRow = { id: string; status: string; currentOnPayments: boolean; launchChecklistComplete: boolean };

export async function completeClientLaunch(input: z.input<typeof launchSchema>) {
  requireFeature("servicing");
  const actor = await requireRole(ADMIN_ROLES);
  const parsed = launchSchema.parse(input);
  const accounts = await db.$queryRaw<AccountRow[]>`
    SELECT "id", "status"::text AS "status", "currentOnPayments", "launchChecklistComplete"
    FROM "ClientAccount" WHERE "id"=${parsed.clientAccountId}
  `;
  const account = accounts[0];
  if (!account) throw new Error("Client account not found.");
  if (account.status === "HOUSE" || account.status === "OFFBOARDED") throw new Error("House or offboarded accounts cannot be launched.");
  if (account.launchChecklistComplete) return { alreadyCompleted: true };

  const now = new Date();
  const healthStatus = account.currentOnPayments ? "HEALTHY" : "PAYMENT_FAILED";
  const accountStatus = account.currentOnPayments ? "ACTIVE" : "PAYMENT_FAILED";
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "ClientAccount"
      SET "launchChecklistComplete"=true,
          "launchCompletedAt"=${now},
          "status"=${accountStatus}::"ClientAccountStatus",
          "healthStatus"=${healthStatus}::"ClientHealthStatus",
          "updatedAt"=${now}
      WHERE "id"=${account.id}
    `;
    await tx.$executeRaw`
      INSERT INTO "ClientServiceActivity" ("id", "clientAccountId", "type", "notes", "occurredAt", "createdAt")
      VALUES (${randomUUID()}, ${account.id}, 'LAUNCH_COMPLETED'::"ClientServiceActivityType", ${parsed.note}, ${now}, ${now})
    `;
    await tx.$executeRaw`
      INSERT INTO "AuditLog" ("id", "actorUserId", "actorRole", "actionType", "entityType", "entityId", "reason", "createdAt")
      VALUES (${randomUUID()}, ${actor.id}, ${actor.role}, 'CLIENT_LAUNCH_COMPLETED', 'ClientAccount', ${account.id}, ${parsed.note}, ${now})
    `;
  });
  return { alreadyCompleted: false };
}
