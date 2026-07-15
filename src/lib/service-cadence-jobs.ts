import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireFeature } from "@/lib/features";
import { assessCadence, latestOf } from "@/lib/service-cadence-schedule";
import { requiredCadence, type ServicePackage } from "@/lib/service-rules";

const DEFAULT_LIMIT = 100;
const SERVICE_PACKAGES = new Set(["STARTER", "GROWTH", "PRO", "ENTERPRISE"]);
const DAY_MS = 24 * 60 * 60 * 1000;

type ServiceCadenceSweepOptions = {
  now?: Date;
  limit?: number;
  dryRun?: boolean;
};

type CadenceAccountRow = {
  id: string;
  clientName: string;
  packageCode: string;
  accountOwnerAgentId: string | null;
  launchCompletedAt: Date | null;
  createdAt: Date;
  lastHealthConfirmationAt: Date | null;
  lastCadenceCaseOpenedAt: Date | null;
  openCadenceCaseCount: number;
};

function readLimit(limit?: number) {
  return Math.max(1, Math.min(limit ?? DEFAULT_LIMIT, 500));
}

/**
 * Opens scheduled check-in Service Cases for ACTIVE client accounts whose
 * package cadence (per requiredCadence) has elapsed since the latest of:
 * launch completion, last recorded health confirmation, or the last cadence
 * case opening. An account with an open cadence case is never given another,
 * so the sweep is safe to run daily.
 */
export async function runServiceCadenceSweep(options: ServiceCadenceSweepOptions = {}) {
  requireFeature("servicing");
  const now = options.now ?? new Date();
  const limit = readLimit(options.limit);
  const dryRun = options.dryRun === true;

  // trigger is compared as text so the read path works even before the
  // SERVICE_CADENCE enum migration is applied.
  const accounts = await db.$queryRaw<CadenceAccountRow[]>(Prisma.sql`
    SELECT account."id", account."clientName", account."packageCode", account."accountOwnerAgentId", account."launchCompletedAt", account."createdAt",
      (SELECT MAX(activity."occurredAt") FROM "ClientServiceActivity" activity WHERE activity."clientAccountId" = account."id" AND activity."type" = 'HEALTH_CONFIRMATION') AS "lastHealthConfirmationAt",
      (SELECT MAX(service_case."openedAt") FROM "ClientServiceCase" service_case WHERE service_case."clientAccountId" = account."id" AND service_case."trigger"::text = 'SERVICE_CADENCE') AS "lastCadenceCaseOpenedAt",
      (SELECT COUNT(*)::int FROM "ClientServiceCase" service_case WHERE service_case."clientAccountId" = account."id" AND service_case."trigger"::text = 'SERVICE_CADENCE' AND service_case."status" IN ('OPEN','IN_PROGRESS','WAITING_ON_CLIENT')) AS "openCadenceCaseCount"
    FROM "ClientAccount" account
    WHERE account."status" = 'ACTIVE'
    ORDER BY account."clientName" ASC
  `);

  let skippedUnknownPackage = 0;
  let skippedOpenCase = 0;
  let notDue = 0;

  const candidates: Array<{
    clientAccountId: string;
    clientName: string;
    packageCode: string;
    cadence: string;
    assignedAgentId: string | null;
    dueAt: Date;
    summary: string;
  }> = [];

  for (const account of accounts) {
    if (!SERVICE_PACKAGES.has(account.packageCode)) {
      skippedUnknownPackage += 1;
      continue;
    }
    const activationAnchor = account.launchCompletedAt ?? account.createdAt;
    const daysSinceActivation = Math.max(0, Math.floor((now.getTime() - activationAnchor.getTime()) / DAY_MS));
    const { cadence } = requiredCadence({ packageCode: account.packageCode as ServicePackage, daysSinceActivation });
    const lastTouch = latestOf(activationAnchor, account.lastHealthConfirmationAt, account.lastCadenceCaseOpenedAt);
    const assessment = assessCadence({ now, lastTouch, cadence });
    if (!assessment.isDue) {
      notDue += 1;
      continue;
    }
    if (account.openCadenceCaseCount > 0) {
      skippedOpenCase += 1;
      continue;
    }
    candidates.push({
      clientAccountId: account.id,
      clientName: account.clientName,
      packageCode: account.packageCode,
      cadence,
      assignedAgentId: account.accountOwnerAgentId,
      dueAt: assessment.due,
      summary: `Scheduled service check-in — ${cadence} cadence (${account.packageCode}).`,
    });
    if (candidates.length >= limit) break;
  }

  const base = {
    ok: true as const,
    scanned: accounts.length,
    skippedOpenCase,
    skippedUnknownPackage,
    notDue,
    limit,
  };

  if (dryRun) {
    return {
      ...base,
      dryRun: true as const,
      opened: 0,
      wouldOpen: candidates.length,
      preview: candidates.map((candidate) => ({
        clientAccountId: candidate.clientAccountId,
        packageCode: candidate.packageCode,
        cadence: candidate.cadence,
        wouldAssignAgentId: candidate.assignedAgentId,
        wouldSetDueAt: candidate.dueAt.toISOString(),
        wouldWriteAuditAction: "SERVICE_CADENCE_CASE_OPENED",
      })),
    };
  }

  const opened: Array<{ clientAccountId: string; serviceCaseId: string; cadence: string; dueAt: string }> = [];

  await db.$transaction(async (tx) => {
    for (const candidate of candidates) {
      const serviceCaseId = randomUUID();
      await tx.$executeRaw`
        INSERT INTO "ClientServiceCase" ("id","clientAccountId","assignedAgentId","trigger","priority","status","summary","openedAt","dueAt","createdAt","updatedAt")
        VALUES (${serviceCaseId},${candidate.clientAccountId},${candidate.assignedAgentId},'SERVICE_CADENCE'::"ClientServiceTrigger",'NORMAL'::"ClientServicePriority",'OPEN'::"ClientServiceCaseStatus",${candidate.summary},${now},${candidate.dueAt},${now},${now})
      `;
      await tx.auditLog.create({
        data: {
          actorRole: "SYSTEM",
          actionType: "SERVICE_CADENCE_CASE_OPENED",
          entityType: "ClientAccount",
          entityId: candidate.clientAccountId,
          reason: candidate.summary,
          metadata: {
            serviceCaseId,
            packageCode: candidate.packageCode,
            cadence: candidate.cadence,
            assignedAgentId: candidate.assignedAgentId,
            dueAt: candidate.dueAt.toISOString(),
          },
        },
      });
      opened.push({ clientAccountId: candidate.clientAccountId, serviceCaseId, cadence: candidate.cadence, dueAt: candidate.dueAt.toISOString() });
    }
  });

  return { ...base, dryRun: false as const, opened: opened.length, wouldOpen: 0, cases: opened };
}
