import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { requireFeature } from "@/lib/features";

const safeId = z.string().trim().min(8).max(128);

const createAccountSchema = z.object({
  clientName: z.string().trim().min(2).max(200),
  packageCode: z.string().trim().min(1).max(120),
  leadId: safeId.optional(),
  ghlLocationId: z.string().trim().max(200).optional(),
  ghlContactId: z.string().trim().max(200).optional(),
  accountOwnerAgentId: safeId.optional(),
  originatingAgentId: safeId.optional(),
});

function nullable(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function createClientAccount(input: z.infer<typeof createAccountSchema>) {
  requireFeature("servicing");
  const actor = await requireRole(ADMIN_ROLES);
  const parsed = createAccountSchema.parse(input);
  const accountId = randomUUID();
  const now = new Date();

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "ClientAccount" ("id","leadId","clientName","ghlLocationId","ghlContactId","packageCode","accountOwnerAgentId","originatingAgentId","createdAt","updatedAt")
      VALUES (${accountId},${parsed.leadId ?? null},${parsed.clientName},${nullable(parsed.ghlLocationId)},${nullable(parsed.ghlContactId)},${parsed.packageCode},${parsed.accountOwnerAgentId ?? null},${parsed.originatingAgentId ?? null},${now},${now})
    `;
    await tx.$executeRaw`
      INSERT INTO "ClientServiceActivity" ("id","clientAccountId","type","notes","occurredAt","createdAt")
      VALUES (${randomUUID()},${accountId},'ACCOUNT_CREATED'::"ClientServiceActivityType",'Client account created in the Mini CRM.',${now},${now})
    `;
    await tx.$executeRaw`
      INSERT INTO "AuditLog" ("id","actorUserId","actorRole","actionType","entityType","entityId","createdAt")
      VALUES (${randomUUID()},${actor.id},${actor.role},'CLIENT_ACCOUNT_CREATED','ClientAccount',${accountId},${now})
    `;
  });

  return { accountId };
}
