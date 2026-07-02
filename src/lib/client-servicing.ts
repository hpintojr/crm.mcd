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

export async function listOpenServiceCases(agentId?: string) {
  const agentFilter = agentId ? Prisma.sql`AND service_case."assignedAgentId" = ${agentId}` : Prisma.empty;
  return db.$queryRaw<ClientServiceCaseSummary[]>(Prisma.sql`
    SELECT service_case."id", service_case."clientAccountId", account."clientName", service_case."assignedAgentId", service_case."trigger"::text AS "trigger", service_case."priority"::text AS "priority", service_case."status"::text AS "status", service_case."summary", service_case."openedAt", service_case."dueAt", service_case."resolvedAt"
    FROM "ClientServiceCase" service_case
    INNER JOIN "ClientAccount" account ON account."id" = service_case."clientAccountId"
    WHERE service_case."status" IN ('OPEN','IN_PROGRESS','WAITING_ON_CLIENT') ${agentFilter}
    ORDER BY CASE service_case."priority"::text WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'NORMAL' THEN 2 ELSE 3 END, service_case."dueAt" NULLS LAST, service_case."openedAt" ASC
  `);
}
