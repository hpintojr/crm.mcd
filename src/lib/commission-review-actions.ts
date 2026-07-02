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

export async function recordCommissionEligibilityReview(input: z.input<typeof reviewSchema>) {
  requireFeature("commissions");
  const actor = await requireRole(ADMIN_ROLES);
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
