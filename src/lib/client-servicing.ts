import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type ClientAccountSummary = {
  id: string;
  clientName: string;
  packageCode: string;
  status: string;
  healthStatus: string;
  currentOnPayments: boolean;
  accountOwnerAgentId: string | null;
  ownerName: string | null;
  lastSuccessfulPaymentAt: Date | null;
  lastClientRequestAt: Date | null;
  lastSupportResponseAt: Date | null;
  lastEscalationAt: Date | null;
  lastResolvedAt: Date | null;
  needsAttentionAt: Date | null;
  nextRenewalAt: Date | null;
  openCaseCount: number;
};

export type ClientServiceCaseSummary = {
  id: string;
  clientAccountId: string;
  clientName: string;
  assignedAgentId: string | null;
  trigger: string;
  priority: string;
  status: string;
  summary: string;
  openedAt: Date;
  dueAt: Date | null;
  resolvedAt: Date | null;
};

export async function listAdminServicingAccounts() {
  return db.$queryRaw<ClientAccountSummary[]>(Prisma.sql`
    SELECT account."id", account."clientName", account."packageCode", account."status"::text AS "status", account."healthStatus"::text AS "healthStatus", account."currentOnPayments", account."accountOwnerAgentId", COALESCE(owner."preferredName", owner."legalName", owner."personalEmail") AS "ownerName", account."lastSuccessfulPaymentAt", account."lastClientRequestAt", account."lastSupportResponseAt", account."lastEscalationAt", account."lastResolvedAt", account."needsAttentionAt", account."nextRenewalAt", (SELECT COUNT(*)::int FROM "ClientServiceCase" service_case WHERE service_case."clientAccountId" = account."id" AND service_case."status" IN ('OPEN','IN_PROGRESS','WAITING_ON_CLIENT')) AS "openCaseCount"
    FROM "ClientAccount" account
    LEFT JOIN "Agent" owner ON owner."id" = account."accountOwnerAgentId"
    ORDER BY CASE account."healthStatus"::text WHEN 'PAYMENT_FAILED' THEN 0 WHEN 'AT_RISK' THEN 1 WHEN 'NEEDS_ATTENTION' THEN 2 ELSE 3 END, account."needsAttentionAt" NULLS LAST, account."clientName" ASC
  `);
}

export async function listAgentServicingAccounts(agentId: string) {
  return db.$queryRaw<ClientAccountSummary[]>(Prisma.sql`
    SELECT account."id", account."clientName", account."packageCode", account."status"::text AS "status", account."healthStatus"::text AS "healthStatus", account."currentOnPayments", account."accountOwnerAgentId", COALESCE(owner."preferredName", owner."legalName", owner."personalEmail") AS "ownerName", account."lastSuccessfulPaymentAt", account."lastClientRequestAt", account."lastSupportResponseAt", account."lastEscalationAt", account."lastResolvedAt", account."needsAttentionAt", account."nextRenewalAt", (SELECT COUNT(*)::int FROM "ClientServiceCase" service_case WHERE service_case."clientAccountId" = account."id" AND service_case."status" IN ('OPEN','IN_PROGRESS','WAITING_ON_CLIENT')) AS "openCaseCount"
    FROM "ClientAccount" account
    LEFT JOIN "Agent" owner ON owner."id" = account."accountOwnerAgentId"
    WHERE account."accountOwnerAgentId" = ${agentId}
    ORDER BY CASE account."healthStatus"::text WHEN 'PAYMENT_FAILED' THEN 0 WHEN 'AT_RISK' THEN 1 WHEN 'NEEDS_ATTENTION' THEN 2 ELSE 3 END, account."needsAttentionAt" NULLS LAST, account."clientName" ASC
  `);
}
