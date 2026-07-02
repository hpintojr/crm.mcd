import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { requireFeature } from "@/lib/features";

const safeId = z.string().trim().min(8).max(128);
const reviewNote = z.string().trim().min(3).max(2_000);
const cents = z.coerce.number().int().min(0).max(100_000_000);

const ledgerIntakeSchema = z.object({
  clientAccountId: safeId,
  paymentRef: z.string().trim().min(3).max(300),
  paymentOccurredAt: z.coerce.date(),
  entryType: z.enum(["RECURRING", "SETUP_FEE", "REFUND_OFFSET", "CHARGEBACK_HOLD", "MANUAL_ADJUSTMENT"]),
  grossCollectedCents: cents,
  refundOffsetCents: cents.default(0),
  commissionableCents: cents.optional(),
  proposedAgentShareCents: cents.optional(),
  calculationNote: z.string().trim().max(2_000).optional(),
  earningAgentId: safeId.optional(),
});

const ledgerHoldSchema = z.object({
  ledgerEntryId: safeId,
  reason: z.enum(["PAYMENT_UNCLEARED", "REFUND", "CHARGEBACK", "MANUAL_REVIEW", "COMPLIANCE_REVIEW", "SERVICE_OWNERSHIP", "TERMINATED"]),
  note: reviewNote,
});

const ledgerClearSchema = z.object({ ledgerEntryId: safeId, note: reviewNote });

async function commissionAdmin() {
  requireFeature("commissions");
  return requireRole(ADMIN_ROLES);
}

type AccountRow = { id: string; packageCode: string; accountOwnerAgentId: string | null; originatingAgentId: string | null };
type DecisionRow = { id: string; status: string };
type LedgerRow = { id: string; clientAccountId: string | null; earningAgentId: string | null; clearedAt: Date | null };

export async function intakeCommissionLedgerEntry(input: z.input<typeof ledgerIntakeSchema>) {
  const actor = await commissionAdmin();
  const parsed = ledgerIntakeSchema.parse(input);
  if (parsed.refundOffsetCents > parsed.grossCollectedCents) throw new Error("Refund offset cannot exceed collected amount.");
  if (parsed.commissionableCents !== undefined && parsed.commissionableCents > parsed.grossCollectedCents - parsed.refundOffsetCents) throw new Error("Commissionable amount cannot exceed net collected amount.");
  const accounts = await db.$queryRaw<AccountRow[]>`
    SELECT "id", "packageCode", "accountOwnerAgentId", "originatingAgentId"
    FROM "ClientAccount" WHERE "id" = ${parsed.clientAccountId}
  `;
  const account = accounts[0];
  if (!account) throw new Error("Client account not found.");
  const earningAgentId = parsed.earningAgentId ?? account.accountOwnerAgentId;
  const now = new Date();
  const ledgerEntryId = randomUUID();

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "CommissionLedgerEntry" ("id", "clientAccountId", "paymentRef", "paymentOccurredAt", "entryType", "status", "packageCode", "earningAgentId", "originatingAgentId", "grossCollectedCents", "refundOffsetCents", "commissionableCents", "proposedAgentShareCents", "calculationNote", "createdById", "createdAt", "updatedAt")
      VALUES (${ledgerEntryId}, ${parsed.clientAccountId}, ${parsed.paymentRef}, ${parsed.paymentOccurredAt}, ${parsed.entryType}::"CommissionLedgerEntryType", 'PENDING_VERIFICATION'::"CommissionLedgerEntryStatus", ${account.packageCode}, ${earningAgentId}, ${account.originatingAgentId}, ${parsed.grossCollectedCents}, ${parsed.refundOffsetCents}, ${parsed.commissionableCents ?? null}, ${parsed.proposedAgentShareCents ?? null}, ${parsed.calculationNote ?? null}, ${actor.id}, ${now}, ${now})
    `;
    await tx.$executeRaw`
      INSERT INTO "AuditLog" ("id", "actorUserId", "actorRole", "actionType", "entityType", "entityId", "metadata", "createdAt")
      VALUES (${randomUUID()}, ${actor.id}, ${actor.role}, 'COMMISSION_LEDGER_INTAKE_RECORDED', 'CommissionLedgerEntry', ${ledgerEntryId}, ${JSON.stringify({ clientAccountId: parsed.clientAccountId, paymentRef: parsed.paymentRef, entryType: parsed.entryType })}::jsonb, ${now})
    `;
  });

  return { ledgerEntryId };
}

export async function applyCommissionLedgerHold(input: z.input<typeof ledgerHoldSchema>) {
  const actor = await commissionAdmin();
  const parsed = ledgerHoldSchema.parse(input);
  const entries = await db.$queryRaw<LedgerRow[]>`
    SELECT "id", "clientAccountId", "earningAgentId", "clearedAt" FROM "CommissionLedgerEntry" WHERE "id" = ${parsed.ledgerEntryId}
  `;
  const entry = entries[0];
  if (!entry) throw new Error("Ledger entry not found.");
  const now = new Date();

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "CommissionHold" ("id", "ledgerEntryId", "clientAccountId", "agentId", "reason", "note", "active", "appliedById", "appliedAt", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${entry.id}, ${entry.clientAccountId}, ${entry.earningAgentId}, ${parsed.reason}::"CommissionHoldReason", ${parsed.note}, true, ${actor.id}, ${now}, ${now}, ${now})
    `;
    await tx.$executeRaw`
      UPDATE "CommissionLedgerEntry" SET "status" = 'ON_HOLD'::"CommissionLedgerEntryStatus", "holdReason" = ${parsed.reason}, "updatedAt" = ${now} WHERE "id" = ${entry.id}
    `;
    await tx.$executeRaw`
      INSERT INTO "AuditLog" ("id", "actorUserId", "actorRole", "actionType", "entityType", "entityId", "reason", "createdAt")
      VALUES (${randomUUID()}, ${actor.id}, ${actor.role}, 'COMMISSION_LEDGER_HOLD_APPLIED', 'CommissionLedgerEntry', ${entry.id}, ${parsed.note}, ${now})
    `;
  });
}

export async function markCommissionLedgerPaymentCleared(input: z.input<typeof ledgerClearSchema>) {
  const actor = await commissionAdmin();
  const parsed = ledgerClearSchema.parse(input);
  const entries = await db.$queryRaw<LedgerRow[]>`
    SELECT "id", "clientAccountId", "earningAgentId", "clearedAt" FROM "CommissionLedgerEntry" WHERE "id" = ${parsed.ledgerEntryId}
  `;
  const entry = entries[0];
  if (!entry) throw new Error("Ledger entry not found.");
  if (!entry.clientAccountId || !entry.earningAgentId) throw new Error("Ledger entry requires a linked client account and earning agent.");
  const [decisions, holds] = await Promise.all([
    db.$queryRaw<DecisionRow[]>`
      SELECT "id", "status"::text AS "status" FROM "CommissionEligibilityDecision"
      WHERE "clientAccountId" = ${entry.clientAccountId} AND "agentId" = ${entry.earningAgentId} AND "supersededAt" IS NULL
      ORDER BY "effectiveAt" DESC LIMIT 1
    `,
    db.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS "count" FROM "CommissionHold" WHERE "ledgerEntryId" = ${entry.id} AND "active" = true
    `,
  ]);
  const now = new Date();
  const eligible = decisions[0]?.status === "ELIGIBLE" && (holds[0]?.count ?? 0) === 0;
  const nextStatus = eligible ? "ELIGIBLE" : "ON_HOLD";

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "CommissionLedgerEntry"
      SET "clearedAt" = ${now}, "status" = ${nextStatus}::"CommissionLedgerEntryStatus", "eligibleAt" = ${eligible ? now : null}, "holdReason" = ${eligible ? null : "Eligibility or hold review required."}, "updatedAt" = ${now}
      WHERE "id" = ${entry.id}
    `;
    await tx.$executeRaw`
      INSERT INTO "AuditLog" ("id", "actorUserId", "actorRole", "actionType", "entityType", "entityId", "reason", "createdAt")
      VALUES (${randomUUID()}, ${actor.id}, ${actor.role}, 'COMMISSION_PAYMENT_CLEARANCE_RECORDED', 'CommissionLedgerEntry', ${entry.id}, ${parsed.note}, ${now})
    `;
  });

  return { status: nextStatus, eligible };
}
