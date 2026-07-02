import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type CommissionReviewCandidate = {
  clientAccountId: string;
  clientName: string;
  packageCode: string;
  accountOwnerAgentId: string | null;
  ownerName: string | null;
  originatingAgentId: string | null;
  currentOnPayments: boolean;
  accountStatus: string;
  profileStatus: string | null;
  latestDecisionStatus: string | null;
  latestDecisionReason: string | null;
  latestDecisionAt: Date | null;
};

export type CommissionLedgerSummary = {
  id: string;
  paymentRef: string;
  clientName: string | null;
  entryType: string;
  status: string;
  grossCollectedCents: number;
  refundOffsetCents: number;
  commissionableCents: number | null;
  proposedAgentShareCents: number | null;
  paymentOccurredAt: Date;
  clearedAt: Date | null;
  eligibleAt: Date | null;
  activeHoldCount: number;
};

export type CommissionProfileSummary = {
  agentId: string;
  agentName: string;
  agentEmail: string;
  agentStatus: string;
  commissionProfileStatus: string | null;
  lastReviewedAt: Date | null;
  reviewNote: string | null;
};

export async function listCommissionReviewCandidates() {
  return db.$queryRaw<CommissionReviewCandidate[]>(Prisma.sql`
    SELECT
      account."id" AS "clientAccountId",
      account."clientName",
      account."packageCode",
      account."accountOwnerAgentId",
      COALESCE(owner."preferredName", owner."legalName", owner."personalEmail") AS "ownerName",
      account."originatingAgentId",
      account."currentOnPayments",
      account."status"::text AS "accountStatus",
      profile."status"::text AS "profileStatus",
      decision."status"::text AS "latestDecisionStatus",
      decision."reason"::text AS "latestDecisionReason",
      decision."effectiveAt" AS "latestDecisionAt"
    FROM "ClientAccount" account
    LEFT JOIN "Agent" owner ON owner."id" = account."accountOwnerAgentId"
    LEFT JOIN "AgentCommissionProfile" profile ON profile."agentId" = account."accountOwnerAgentId"
    LEFT JOIN LATERAL (
      SELECT "status", "reason", "effectiveAt"
      FROM "CommissionEligibilityDecision"
      WHERE "clientAccountId" = account."id"
        AND "agentId" = account."accountOwnerAgentId"
        AND "supersededAt" IS NULL
      ORDER BY "effectiveAt" DESC
      LIMIT 1
    ) decision ON TRUE
    ORDER BY account."clientName" ASC
  `);
}

export async function listCommissionLedgerSummary() {
  return db.$queryRaw<CommissionLedgerSummary[]>(Prisma.sql`
    SELECT
      entry."id",
      entry."paymentRef",
      account."clientName",
      entry."entryType"::text AS "entryType",
      entry."status"::text AS "status",
      entry."grossCollectedCents",
      entry."refundOffsetCents",
      entry."commissionableCents",
      entry."proposedAgentShareCents",
      entry."paymentOccurredAt",
      entry."clearedAt",
      entry."eligibleAt",
      (SELECT COUNT(*)::int FROM "CommissionHold" hold WHERE hold."ledgerEntryId" = entry."id" AND hold."active" = true) AS "activeHoldCount"
    FROM "CommissionLedgerEntry" entry
    LEFT JOIN "ClientAccount" account ON account."id" = entry."clientAccountId"
    ORDER BY entry."paymentOccurredAt" DESC, entry."createdAt" DESC
    LIMIT 100
  `);
}

export async function listCommissionProfiles() {
  return db.$queryRaw<CommissionProfileSummary[]>(Prisma.sql`
    SELECT
      agent."id" AS "agentId",
      COALESCE(agent."preferredName", agent."legalName", agent."personalEmail") AS "agentName",
      agent."personalEmail" AS "agentEmail",
      agent."status"::text AS "agentStatus",
      profile."status"::text AS "commissionProfileStatus",
      profile."lastReviewedAt",
      profile."reviewNote"
    FROM "Agent" agent
    LEFT JOIN "AgentCommissionProfile" profile ON profile."agentId" = agent."id"
    WHERE agent."status" IN ('ACTIVE'::"AgentStatus", 'OFFBOARDED'::"AgentStatus", 'SUSPENDED'::"AgentStatus")
       OR profile."id" IS NOT NULL
    ORDER BY agent."legalName" ASC
  `);
}
