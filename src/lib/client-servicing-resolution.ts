import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { requireFeature } from "@/lib/features";

const safeId = z.string().trim().min(8).max(128);
const note = z.string().trim().min(3).max(2_000);

const responseSchema = z.object({ clientAccountId: safeId, serviceCaseId: safeId.optional(), note });
const resolveSchema = z.object({ clientAccountId: safeId, serviceCaseId: safeId, resolution: note });
const houseSchema = z.object({
  clientAccountId: safeId,
  reason: z.enum(["AGENT_DECLINES_SERVICE", "TERMINATED", "MANAGER_REASSIGNMENT", "HOUSE_REVIEW"]),
  note,
});
const retainSchema = z.object({ clientAccountId: safeId, note });

async function actorContext() {
  requireFeature("servicing");
  const user = await requireRole([...ADMIN_ROLES, "AGENT"]);
  const isAdmin = ADMIN_ROLES.includes(user.role);
  const agent = isAdmin ? null : await db.agent.findUnique({ where: { userId: user.id } });
  if (!isAdmin && !agent) throw new Error("A linked agent record is required for client servicing.");
  return { user, isAdmin, agent };
}

async function accountForActor(clientAccountId: string, actor: Awaited<ReturnType<typeof actorContext>>) {
  const rows = await db.$queryRaw<Array<{ id: string; accountOwnerAgentId: string | null; currentOnPayments: boolean }>>`
    SELECT "id", "accountOwnerAgentId", "currentOnPayments" FROM "ClientAccount" WHERE "id" = ${clientAccountId}
  `;
  const account = rows[0];
  if (!account) throw new Error("Client account not found.");
  if (!actor.isAdmin && account.accountOwnerAgentId !== actor.agent?.id) throw new Error("This client account is not assigned to you.");
  return account;
}

export async function recordServiceResponse(input: z.infer<typeof responseSchema>) {
  const actor = await actorContext();
  const parsed = responseSchema.parse(input);
  const account = await accountForActor(parsed.clientAccountId, actor);
  const now = new Date();
  const agentId = actor.isAdmin ? account.accountOwnerAgentId : actor.agent!.id;

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "ClientServiceActivity" ("id","clientAccountId","serviceCaseId","agentId","type","notes","occurredAt","createdAt")
      VALUES (${randomUUID()},${parsed.clientAccountId},${parsed.serviceCaseId ?? null},${agentId},'SUPPORT_RESPONSE'::"ClientServiceActivityType",${parsed.note},${now},${now})
    `;
    await tx.$executeRaw`
      UPDATE "ClientAccount" SET "lastSupportResponseAt"=${now},"updatedAt"=${now} WHERE "id"=${parsed.clientAccountId}
    `;
    if (parsed.serviceCaseId) {
      await tx.$executeRaw`
        UPDATE "ClientServiceCase" SET "status"='IN_PROGRESS'::"ClientServiceCaseStatus","updatedAt"=${now} WHERE "id"=${parsed.serviceCaseId} AND "clientAccountId"=${parsed.clientAccountId} AND "status"='OPEN'::"ClientServiceCaseStatus"
      `;
    }
    await tx.$executeRaw`
      INSERT INTO "AuditLog" ("id","actorUserId","actorRole","actionType","entityType","entityId","reason","createdAt")
      VALUES (${randomUUID()},${actor.user.id},${actor.user.role},'CLIENT_SERVICE_RESPONSE_RECORDED','ClientAccount',${parsed.clientAccountId},${parsed.note},${now})
    `;
  });
}

export async function resolveClientServiceCase(input: z.infer<typeof resolveSchema>) {
  const actor = await actorContext();
  const parsed = resolveSchema.parse(input);
  const account = await accountForActor(parsed.clientAccountId, actor);
  const now = new Date();
  const agentId = actor.isAdmin ? account.accountOwnerAgentId : actor.agent!.id;

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "ClientServiceCase" SET "status"='RESOLVED'::"ClientServiceCaseStatus","resolvedAt"=${now},"resolutionNote"=${parsed.resolution},"updatedAt"=${now}
      WHERE "id"=${parsed.serviceCaseId} AND "clientAccountId"=${parsed.clientAccountId} AND "status" IN ('OPEN'::"ClientServiceCaseStatus",'IN_PROGRESS'::"ClientServiceCaseStatus",'WAITING_ON_CLIENT'::"ClientServiceCaseStatus")
    `;
    await tx.$executeRaw`
      INSERT INTO "ClientServiceActivity" ("id","clientAccountId","serviceCaseId","agentId","type","notes","occurredAt","createdAt")
      VALUES (${randomUUID()},${parsed.clientAccountId},${parsed.serviceCaseId},${agentId},'RESOLUTION'::"ClientServiceActivityType",${parsed.resolution},${now},${now})
    `;
    await tx.$executeRaw`
      UPDATE "ClientAccount"
      SET "status"=CASE WHEN "currentOnPayments" THEN 'ACTIVE'::"ClientAccountStatus" ELSE 'PAYMENT_FAILED'::"ClientAccountStatus" END,
          "healthStatus"=CASE WHEN "currentOnPayments" THEN 'HEALTHY'::"ClientHealthStatus" ELSE 'PAYMENT_FAILED'::"ClientHealthStatus" END,
          "lastResolvedAt"=${now},
          "needsAttentionAt"=CASE WHEN "currentOnPayments" THEN NULL ELSE "needsAttentionAt" END,
          "updatedAt"=${now}
      WHERE "id"=${parsed.clientAccountId}
    `;
    await tx.$executeRaw`
      INSERT INTO "AuditLog" ("id","actorUserId","actorRole","actionType","entityType","entityId","reason","createdAt")
      VALUES (${randomUUID()},${actor.user.id},${actor.user.role},'CLIENT_SERVICE_CASE_RESOLVED','ClientServiceCase',${parsed.serviceCaseId},${parsed.resolution},${now})
    `;
  });
}

export async function transferClientServiceToHouse(input: z.infer<typeof houseSchema>) {
  requireFeature("servicing");
  const actor = await requireRole(ADMIN_ROLES);
  const parsed = houseSchema.parse(input);
  const rows = await db.$queryRaw<Array<{ accountOwnerAgentId: string | null }>>`
    SELECT "accountOwnerAgentId" FROM "ClientAccount" WHERE "id" = ${parsed.clientAccountId}
  `;
  const account = rows[0];
  if (!account) throw new Error("Client account not found.");
  const now = new Date();

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "ClientAccount" SET "accountOwnerAgentId"=NULL,"status"='HOUSE'::"ClientAccountStatus","houseTransferredAt"=${now},"houseTransferReason"=${parsed.note},"updatedAt"=${now} WHERE "id"=${parsed.clientAccountId}
    `;
    await tx.$executeRaw`
      UPDATE "ClientServiceCase" SET "assignedAgentId"=NULL,"updatedAt"=${now} WHERE "clientAccountId"=${parsed.clientAccountId} AND "status" IN ('OPEN'::"ClientServiceCaseStatus",'IN_PROGRESS'::"ClientServiceCaseStatus",'WAITING_ON_CLIENT'::"ClientServiceCaseStatus")
    `;
    await tx.$executeRaw`
      INSERT INTO "ClientServiceAssignmentEvent" ("id","clientAccountId","fromAgentId","toAgentId","reason","note","createdById","createdAt")
      VALUES (${randomUUID()},${parsed.clientAccountId},${account.accountOwnerAgentId},NULL,${parsed.reason}::"ClientServiceTransferReason",${parsed.note},${actor.id},${now})
    `;
    await tx.$executeRaw`
      INSERT INTO "ClientServiceActivity" ("id","clientAccountId","type","notes","occurredAt","createdAt")
      VALUES (${randomUUID()},${parsed.clientAccountId},'HOUSE_TRANSFER'::"ClientServiceActivityType",${parsed.note},${now},${now})
    `;
    await tx.$executeRaw`
      INSERT INTO "AuditLog" ("id","actorUserId","actorRole","actionType","entityType","entityId","reason","createdAt")
      VALUES (${randomUUID()},${actor.id},${actor.role},'CLIENT_SERVICE_TRANSFERRED_TO_HOUSE','ClientAccount',${parsed.clientAccountId},${parsed.note},${now})
    `;
  });
}

export async function recordAgentContinuesService(input: z.infer<typeof retainSchema>) {
  requireFeature("servicing");
  const actor = await requireRole(ADMIN_ROLES);
  const parsed = retainSchema.parse(input);
  const rows = await db.$queryRaw<Array<{ accountOwnerAgentId: string | null }>>`
    SELECT "accountOwnerAgentId" FROM "ClientAccount" WHERE "id" = ${parsed.clientAccountId}
  `;
  const account = rows[0];
  if (!account?.accountOwnerAgentId) throw new Error("A current servicing agent is required to record continued service.");
  const now = new Date();

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "ClientServiceAssignmentEvent" ("id","clientAccountId","fromAgentId","toAgentId","reason","note","createdById","createdAt")
      VALUES (${randomUUID()},${parsed.clientAccountId},${account.accountOwnerAgentId},${account.accountOwnerAgentId},'AGENT_CONTINUES_SERVICE'::"ClientServiceTransferReason",${parsed.note},${actor.id},${now})
    `;
    await tx.$executeRaw`
      INSERT INTO "ClientServiceActivity" ("id","clientAccountId","agentId","type","notes","occurredAt","createdAt")
      VALUES (${randomUUID()},${parsed.clientAccountId},${account.accountOwnerAgentId},'OWNERSHIP_RETAINED'::"ClientServiceActivityType",${parsed.note},${now},${now})
    `;
    await tx.$executeRaw`
      INSERT INTO "AuditLog" ("id","actorUserId","actorRole","actionType","entityType","entityId","reason","createdAt")
      VALUES (${randomUUID()},${actor.id},${actor.role},'CLIENT_SERVICE_OWNERSHIP_RETAINED','ClientAccount',${parsed.clientAccountId},${parsed.note},${now})
    `;
  });
}
