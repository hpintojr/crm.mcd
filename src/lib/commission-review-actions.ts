import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { requireFeature } from "@/lib/features";
import { evaluateCommissionEligibility, type ClientServiceState, type CommissionProfileState } from "@/lib/commission-policy";

const reviewSchema = z.object({
  clientAccountId: z.string().trim().min(8).max(128),
  agentId: z.string().trim().min(8).max(128),
  note: z.string().trim().min(3).max(2_000).optional(),
});

const profileSchema = z.object({
  agentId: z.string().trim().min(8).max(128),
  status: z.enum(["ACTIVE", "RETIRED", "TERMINATED", "ON_HOLD"]),
  note: z.string().trim().min(3).max(2_000).optional(),
});

type AccountRow = {
  id: string;
  accountOwnerAgentId: string | null;
  currentOnPayments: boolean;
  status: string;
};

type ProfileRow = { status: string };

function serviceState(account: AccountRow): ClientServiceState {
  if (account.status === "HOUSE") return "HOUSE";
  return account.accountOwnerAgentId ? "ACTIVE" : "UNASSIGNED";
}

function profileState(row?: ProfileRow): CommissionProfileState {
  if (!row) return "MISSING";
  if (row.status === "RETIRED" || row.status === "TERMINATED" || row.status === "ON_HOLD") return row.status;
  return "ACTIVE";
}

async function commissionAdmin() {
  requireFeature("commissions");
  return requireRole(ADMIN_ROLES);
}

export async function recordCommissionEligibilityReview(input: z.input<typeof reviewSchema>) {
  const actor = await commissionAdmin();
  const parsed = reviewSchema.parse(input);
  const [accounts, profiles] = await Promise.all([
    db.$queryRaw<AccountRow[]>`
      SELECT "id", "accountOwnerAgentId", "currentOnPayments", "status"::text AS "status"
      FROM "ClientAccount" WHERE "id" = ${parsed.clientAccountId}
    `,
    db.$queryRaw<ProfileRow[]>`
      SELECT "status"::text AS "status" FROM "AgentCommissionProfile" WHERE "agentId" = ${parsed.agentId}
    `,
  ]);
  const account = accounts[0];
  if (!account) throw new Error("Client account not found.");

  const result = evaluateCommissionEligibility({
    profile: profileState(profiles[0]),
    serviceState: serviceState(account),
    accountOwnerAgentId: account.accountOwnerAgentId,
    candidateAgentId: parsed.agentId,
    currentOnPayments: account.currentOnPayments,
  });
  const now = new Date();
  const decisionId = randomUUID();

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "CommissionEligibilityDecision"
      SET "supersededAt" = ${now}
      WHERE "clientAccountId" = ${parsed.clientAccountId}
        AND "agentId" = ${parsed.agentId}
        AND "supersededAt" IS NULL
    `;
    await tx.$executeRaw`
      INSERT INTO "CommissionEligibilityDecision" ("id", "clientAccountId", "agentId", "status", "reason", "effectiveAt", "reviewNote", "recordedById", "createdAt")
      VALUES (${decisionId}, ${parsed.clientAccountId}, ${parsed.agentId}, ${result.status}::"CommissionEligibilityStatus", ${result.reason}::"CommissionEligibilityReason", ${now}, ${parsed.note ?? null}, ${actor.id}, ${now})
    `;
    await tx.$executeRaw`
      INSERT INTO "AuditLog" ("id", "actorUserId", "actorRole", "actionType", "entityType", "entityId", "metadata", "createdAt")
      VALUES (${randomUUID()}, ${actor.id}, ${actor.role}, 'COMMISSION_ELIGIBILITY_REVIEWED', 'CommissionEligibilityDecision', ${decisionId}, ${JSON.stringify({ clientAccountId: parsed.clientAccountId, agentId: parsed.agentId, ...result })}::jsonb, ${now})
    `;
  });

  return { decisionId, ...result };
}

export async function setCommissionProfileStatus(input: z.input<typeof profileSchema>) {
  const actor = await commissionAdmin();
  const parsed = profileSchema.parse(input);
  const agent = await db.agent.findUnique({ where: { id: parsed.agentId }, select: { id: true } });
  if (!agent) throw new Error("Agent not found.");
  const now = new Date();

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "AgentCommissionProfile" ("id", "agentId", "status", "effectiveAt", "retiredAt", "terminatedAt", "holdReason", "reviewNote", "lastReviewedAt", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${parsed.agentId}, ${parsed.status}::"CommissionProfileStatus", ${now}, ${parsed.status === "RETIRED" ? now : null}, ${parsed.status === "TERMINATED" ? now : null}, ${parsed.status === "ON_HOLD" ? parsed.note ?? "Profile review hold." : null}, ${parsed.note ?? null}, ${now}, ${now}, ${now})
      ON CONFLICT ("agentId") DO UPDATE SET
        "status" = EXCLUDED."status",
        "effectiveAt" = EXCLUDED."effectiveAt",
        "retiredAt" = CASE WHEN EXCLUDED."status" = 'RETIRED'::"CommissionProfileStatus" THEN EXCLUDED."effectiveAt" ELSE "AgentCommissionProfile"."retiredAt" END,
        "terminatedAt" = CASE WHEN EXCLUDED."status" = 'TERMINATED'::"CommissionProfileStatus" THEN EXCLUDED."effectiveAt" ELSE "AgentCommissionProfile"."terminatedAt" END,
        "holdReason" = EXCLUDED."holdReason",
        "reviewNote" = EXCLUDED."reviewNote",
        "lastReviewedAt" = EXCLUDED."lastReviewedAt",
        "updatedAt" = EXCLUDED."updatedAt"
    `;
    await tx.$executeRaw`
      INSERT INTO "AuditLog" ("id", "actorUserId", "actorRole", "actionType", "entityType", "entityId", "reason", "createdAt")
      VALUES (${randomUUID()}, ${actor.id}, ${actor.role}, 'COMMISSION_PROFILE_UPDATED', 'Agent', ${parsed.agentId}, ${parsed.note ?? null}, ${now})
    `;
  });
}
