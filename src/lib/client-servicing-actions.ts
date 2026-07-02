import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { requireFeature } from "@/lib/features";

const safeId = z.string().trim().min(8).max(128);
const triggerSchema = z.enum(["CLIENT_REQUEST", "SUPPORT_ISSUE", "PAYMENT_PROBLEM", "RENEWAL_EVENT", "ESCALATION", "MANUAL_REVIEW"]);
const prioritySchema = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]);
const launchSchema = z.object({ clientAccountId: safeId, paymentState: z.enum(["CURRENT", "PAYMENT_ISSUE"]), note: z.string().trim().min(3).max(2_000) });

const createAccountSchema = z.object({
  clientName: z.string().trim().min(2).max(200),
  packageCode: z.string().trim().min(1).max(120),
  leadId: safeId.optional(),
  ghlLocationId: z.string().trim().max(200).optional(),
  ghlContactId: z.string().trim().max(200).optional(),
  accountOwnerAgentId: safeId.optional(),
  originatingAgentId: safeId.optional(),
});

const openCaseSchema = z.object({
  clientAccountId: safeId,
  trigger: triggerSchema,
  priority: prioritySchema.default("NORMAL"),
  summary: z.string().trim().min(3).max(2_000),
  dueAt: z.coerce.date().optional(),
  assignedAgentId: safeId.optional(),
});

export type OpenClientServiceCaseInput = {
  clientAccountId: string;
  trigger: z.infer<typeof triggerSchema>;
  priority?: z.infer<typeof prioritySchema>;
  summary: string;
  dueAt?: string | Date;
  assignedAgentId?: string;
};

function nullable(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function servicingActor() {
  requireFeature("servicing");
  const user = await requireRole([...ADMIN_ROLES, "AGENT"]);
  const isAdmin = ADMIN_ROLES.includes(user.role);
  const agent = isAdmin ? null : await db.agent.findUnique({ where: { userId: user.id } });
  if (!isAdmin && !agent) throw new Error("A linked agent record is required for client servicing.");
  return { user, isAdmin, agent };
}

async function accountAccess(clientAccountId: string, actor: Awaited<ReturnType<typeof servicingActor>>) {
  const rows = await db.$queryRaw<Array<{ id: string; accountOwnerAgentId: string | null }>>`
    SELECT "id", "accountOwnerAgentId" FROM "ClientAccount" WHERE "id" = ${clientAccountId}
  `;
  const account = rows[0];
  if (!account) throw new Error("Client account not found.");
  if (!actor.isAdmin && account.accountOwnerAgentId !== actor.agent?.id) throw new Error("This client account is not assigned to you.");
  return account;
}

function openingActivity(trigger: z.infer<typeof triggerSchema>) {
  if (trigger === "PAYMENT_PROBLEM") return "PAYMENT_ISSUE";
  if (trigger === "RENEWAL_EVENT") return "RENEWAL_EVENT";
  if (trigger === "ESCALATION") return "ESCALATION";
  if (trigger === "MANUAL_REVIEW") return "HEALTH_CONFIRMATION";
  return "CLIENT_REQUEST";
}

export async function createClientAccount(input: z.input<typeof createAccountSchema>) {
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

export async function confirmClientLaunch(input: z.input<typeof launchSchema>) {
  requireFeature("servicing");
  const actor = await requireRole(ADMIN_ROLES);
  const parsed = launchSchema.parse(input);
  const rows = await db.$queryRaw<Array<{ id: string; status: string }>>`
    SELECT "id", "status"::text AS "status" FROM "ClientAccount" WHERE "id"=${parsed.clientAccountId}
  `;
  const account = rows[0];
  if (!account) throw new Error("Client account not found.");
  if (account.status !== "PENDING_LAUNCH") throw new Error("Only pending-launch client accounts can be confirmed from this queue.");
  const now = new Date();

  await db.$transaction(async (tx) => {
    if (parsed.paymentState === "CURRENT") {
      await tx.$executeRaw`
        UPDATE "ClientAccount" SET "launchChecklistComplete"=true,"status"='ACTIVE'::"ClientAccountStatus","healthStatus"='HEALTHY'::"ClientHealthStatus","currentOnPayments"=true,"lastSuccessfulPaymentAt"=${now},"needsAttentionAt"=NULL,"updatedAt"=${now} WHERE "id"=${parsed.clientAccountId}
      `;
    } else {
      await tx.$executeRaw`
        UPDATE "ClientAccount" SET "launchChecklistComplete"=true,"status"='PAYMENT_FAILED'::"ClientAccountStatus","healthStatus"='PAYMENT_FAILED'::"ClientHealthStatus","currentOnPayments"=false,"lastPaymentIssueAt"=${now},"needsAttentionAt"=${now},"updatedAt"=${now} WHERE "id"=${parsed.clientAccountId}
      `;
    }
    await tx.$executeRaw`
      INSERT INTO "AuditLog" ("id","actorUserId","actorRole","actionType","entityType","entityId","reason","metadata","createdAt")
      VALUES (${randomUUID()},${actor.id},${actor.role},'CLIENT_LAUNCH_CONFIRMED','ClientAccount',${parsed.clientAccountId},${parsed.note},${JSON.stringify({ paymentState: parsed.paymentState })}::jsonb,${now})
    `;
  });
}

export async function openClientServiceCase(input: OpenClientServiceCaseInput) {
  const actor = await servicingActor();
  const parsed = openCaseSchema.parse(input);
  const account = await accountAccess(parsed.clientAccountId, actor);
  const caseId = randomUUID();
  const now = new Date();
  const assignedAgentId = actor.isAdmin ? parsed.assignedAgentId ?? account.accountOwnerAgentId : actor.agent!.id;
  const activityType = openingActivity(parsed.trigger);

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "ClientServiceCase" ("id","clientAccountId","assignedAgentId","trigger","priority","status","summary","openedAt","dueAt","createdAt","updatedAt")
      VALUES (${caseId},${parsed.clientAccountId},${assignedAgentId},${parsed.trigger}::"ClientServiceTrigger",${parsed.priority}::"ClientServicePriority",'OPEN'::"ClientServiceCaseStatus",${parsed.summary},${now},${parsed.dueAt ?? null},${now},${now})
    `;
    await tx.$executeRaw`
      INSERT INTO "ClientServiceActivity" ("id","clientAccountId","serviceCaseId","agentId","type","notes","occurredAt","createdAt")
      VALUES (${randomUUID()},${parsed.clientAccountId},${caseId},${assignedAgentId},${activityType}::"ClientServiceActivityType",${parsed.summary},${now},${now})
    `;

    if (parsed.trigger === "PAYMENT_PROBLEM") {
      await tx.$executeRaw`
        UPDATE "ClientAccount" SET "status"='PAYMENT_FAILED'::"ClientAccountStatus","healthStatus"='PAYMENT_FAILED'::"ClientHealthStatus","currentOnPayments"=false,"lastPaymentIssueAt"=${now},"needsAttentionAt"=${now},"updatedAt"=${now} WHERE "id"=${parsed.clientAccountId}
      `;
    } else if (parsed.trigger === "ESCALATION") {
      await tx.$executeRaw`
        UPDATE "ClientAccount" SET "status"='AT_RISK'::"ClientAccountStatus","healthStatus"='AT_RISK'::"ClientHealthStatus","lastEscalationAt"=${now},"needsAttentionAt"=${now},"updatedAt"=${now} WHERE "id"=${parsed.clientAccountId}
      `;
    } else if (parsed.trigger === "CLIENT_REQUEST") {
      await tx.$executeRaw`
        UPDATE "ClientAccount" SET "healthStatus"='NEEDS_ATTENTION'::"ClientHealthStatus","lastClientRequestAt"=${now},"needsAttentionAt"=${now},"updatedAt"=${now} WHERE "id"=${parsed.clientAccountId}
      `;
    } else {
      await tx.$executeRaw`
        UPDATE "ClientAccount" SET "healthStatus"='NEEDS_ATTENTION'::"ClientHealthStatus","needsAttentionAt"=${now},"updatedAt"=${now} WHERE "id"=${parsed.clientAccountId}
      `;
    }

    await tx.$executeRaw`
      INSERT INTO "AuditLog" ("id","actorUserId","actorRole","actionType","entityType","entityId","metadata","createdAt")
      VALUES (${randomUUID()},${actor.user.id},${actor.user.role},'CLIENT_SERVICE_CASE_OPENED','ClientServiceCase',${caseId},${JSON.stringify({ clientAccountId: parsed.clientAccountId, trigger: parsed.trigger, priority: parsed.priority })}::jsonb,${now})
    `;
  });

  return { caseId };
}
