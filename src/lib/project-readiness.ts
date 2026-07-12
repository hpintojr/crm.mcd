import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { getLeadDeploymentVerificationSnapshot } from "@/lib/lead-deployment-verification";

export const PROJECT_READINESS_VERSION = "2026-07-12-pr101";

export const CLIENT_SERVICE_SCHEMA_TABLES = [
  "ClientAccount",
  "ClientServiceActivity",
  "ClientServiceCase",
  "ClientServiceAssignmentEvent",
] as const;

export const COMMISSION_SCHEMA_TABLES = [
  "CommissionLedgerEntry",
  "CommissionHold",
  "CommissionEligibilityDecision",
  "AgentCommissionProfile",
  "PayoutBatch",
  "PayoutDestination",
  "PayoutLine",
] as const;

export const COMMISSION_SCHEMA_ENUMS = [
  {
    name: "CommissionLedgerEntryType",
    values: ["RECURRING", "SETUP_FEE", "REFUND_OFFSET", "CHARGEBACK_HOLD", "MANUAL_ADJUSTMENT"],
  },
  {
    name: "CommissionLedgerEntryStatus",
    values: ["PENDING_VERIFICATION", "ON_HOLD", "ELIGIBLE"],
  },
  {
    name: "CommissionHoldReason",
    values: ["PAYMENT_UNCLEARED", "REFUND", "CHARGEBACK", "MANUAL_REVIEW", "COMPLIANCE_REVIEW", "SERVICE_OWNERSHIP", "TERMINATED"],
  },
  {
    name: "CommissionEligibilityStatus",
    values: ["PENDING", "ELIGIBLE", "ON_HOLD", "INELIGIBLE"],
  },
  {
    name: "CommissionEligibilityReason",
    values: ["ACTIVE_SERVICE", "RETIRED", "AGENT_DECLINES_SERVICE", "HOUSE_TRANSFER", "TERMINATED", "PAYMENT_UNCLEARED", "MANUAL_HOLD", "MISSING_SERVICE_OWNER", "MANUAL_REVIEW"],
  },
  {
    name: "CommissionProfileStatus",
    values: ["ACTIVE", "RETIRED", "TERMINATED", "ON_HOLD"],
  },
  {
    name: "PayoutBatchStatus",
    values: ["DRAFT", "APPROVED", "PROCESSING", "PAID", "FAILED", "CANCELLED"],
  },
] as const;

export const LEGACY_COMMISSION_TYPES = ["CommissionEntryType", "CommissionEntryStatus", "ContractType"] as const;

export const LEGACY_COMMISSION_LEDGER_COLUMNS = [
  "contractType",
  "amountCollectedCents",
  "processingFeeCents",
  "taxCents",
  "wholesaleCents",
  "netCommissionableCents",
  "partnerShareCents",
  "mcdShareCents",
  "financeApprovedById",
  "financeApprovedAt",
  "payoutBatchId",
  "payoutReference",
] as const;

const ACCEPTANCE_MODULES = [
  {
    key: "LEADS",
    label: "Lead Flow",
    actionType: "LEAD_PRODUCTION_ACCEPTANCE_RECORDED",
    entityType: "LeadProductionAcceptanceStep",
    totalSteps: 18,
  },
  {
    key: "SERVICING",
    label: "Client Servicing",
    actionType: "SERVICING_ACCEPTANCE_RECORDED",
    entityType: "ServicingAcceptanceStep",
    totalSteps: 9,
  },
  {
    key: "COMMISSIONS",
    label: "Commissions",
    actionType: "COMMISSION_ACCEPTANCE_RECORDED",
    entityType: "CommissionAcceptanceStep",
    totalSteps: 8,
  },
] as const;

type SchemaNameRow = { name: string };
type EnumCatalogRow = { name: string; values: string[] };
type AcceptanceOutcome = "PASS" | "FAIL" | "DEFERRED";

export type ProjectModuleState =
  | "ACCEPTED"
  | "CONTROLLED_TEST"
  | "BUILT_GATED"
  | "MIGRATION_STAGED"
  | "SCHEMA_DRIFT"
  | "READINESS_ONLY"
  | "STAGED_LOCKED"
  | "UNKNOWN";

function readOutcome(metadata: unknown): AcceptanceOutcome | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const outcome = (metadata as { outcome?: unknown }).outcome;
  return outcome === "PASS" || outcome === "FAIL" || outcome === "DEFERRED" ? outcome : null;
}

function missingFrom(expected: readonly string[], present: ReadonlySet<string>) {
  return expected.filter((name) => !present.has(name));
}

function sameValues(actual: readonly string[] | undefined, expected: readonly string[]) {
  return Boolean(actual) && actual?.length === expected.length && actual.every((value, index) => value === expected[index]);
}

async function readSchemaCatalog() {
  const [tableRows, enumRows, ledgerColumnRows] = await Promise.all([
    db.$queryRaw<SchemaNameRow[]>(Prisma.sql`
      SELECT table_name AS "name"
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'ClientAccount',
          'ClientServiceActivity',
          'ClientServiceCase',
          'ClientServiceAssignmentEvent',
          'CommissionLedgerEntry',
          'CommissionHold',
          'CommissionEligibilityDecision',
          'AgentCommissionProfile',
          'PayoutBatch',
          'PayoutDestination',
          'PayoutLine'
        )
      ORDER BY table_name
    `),
    db.$queryRaw<EnumCatalogRow[]>(Prisma.sql`
      SELECT
        type.typname AS "name",
        array_agg(enum.enumlabel ORDER BY enum.enumsortorder)::text[] AS "values"
      FROM pg_type type
      JOIN pg_enum enum ON enum.enumtypid = type.oid
      JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
      WHERE namespace.nspname = 'public'
        AND type.typname IN (
          'CommissionLedgerEntryType',
          'CommissionLedgerEntryStatus',
          'CommissionHoldReason',
          'CommissionEligibilityStatus',
          'CommissionEligibilityReason',
          'CommissionProfileStatus',
          'PayoutBatchStatus',
          'CommissionEntryType',
          'CommissionEntryStatus',
          'ContractType'
        )
      GROUP BY type.typname
      ORDER BY type.typname
    `),
    db.$queryRaw<SchemaNameRow[]>(Prisma.sql`
      SELECT column_name AS "name"
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'CommissionLedgerEntry'
      ORDER BY ordinal_position
    `),
  ]);

  const tableNames = new Set(tableRows.map((row) => row.name));
  const enumMap = new Map(enumRows.map((row) => [row.name, row.values]));
  const ledgerColumns = new Set(ledgerColumnRows.map((row) => row.name));

  const clientServiceMissing = missingFrom(CLIENT_SERVICE_SCHEMA_TABLES, tableNames);
  const commissionMissing = missingFrom(COMMISSION_SCHEMA_TABLES, tableNames);
  const legacyTypesPresent = LEGACY_COMMISSION_TYPES.filter((name) => enumMap.has(name));
  const legacyColumnsPresent = LEGACY_COMMISSION_LEDGER_COLUMNS.filter((name) => ledgerColumns.has(name));
  const commissionEnums = COMMISSION_SCHEMA_ENUMS.map((expected) => {
    const actualValues = enumMap.get(expected.name) ?? [];
    return {
      name: expected.name,
      expectedValues: [...expected.values],
      actualValues,
      present: enumMap.has(expected.name),
      matches: sameValues(actualValues, expected.values),
    };
  });

  const expectedCommissionObjectsPresent =
    COMMISSION_SCHEMA_TABLES.length - commissionMissing.length + commissionEnums.filter((item) => item.present).length;
  const aligned =
    commissionMissing.length === 0 &&
    commissionEnums.every((item) => item.matches) &&
    legacyTypesPresent.length === 0 &&
    legacyColumnsPresent.length === 0;
  const stagedOnly = expectedCommissionObjectsPresent === 0 && legacyTypesPresent.length === 0 && legacyColumnsPresent.length === 0;

  return {
    ok: true as const,
    clientService: {
      state: clientServiceMissing.length === 0 ? ("SOURCE_ALIGNED" as const) : ("PARTIAL_OR_MISSING" as const),
      expectedTables: [...CLIENT_SERVICE_SCHEMA_TABLES],
      presentTables: CLIENT_SERVICE_SCHEMA_TABLES.filter((name) => tableNames.has(name)),
      missingTables: clientServiceMissing,
    },
    commission: {
      state: aligned ? ("SOURCE_ALIGNED" as const) : stagedOnly ? ("STAGED_ONLY" as const) : ("PARTIAL_OR_DRIFTED" as const),
      expectedTables: [...COMMISSION_SCHEMA_TABLES],
      presentTables: COMMISSION_SCHEMA_TABLES.filter((name) => tableNames.has(name)),
      missingTables: commissionMissing,
      enums: commissionEnums,
      legacyTypesPresent,
      legacyLedgerColumnsPresent: legacyColumnsPresent,
    },
  };
}

async function readAcceptanceSummary() {
  const records = await db.auditLog.findMany({
    where: {
      OR: ACCEPTANCE_MODULES.map((module) => ({
        actionType: module.actionType,
        entityType: module.entityType,
      })),
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
    select: {
      actionType: true,
      entityId: true,
      metadata: true,
      createdAt: true,
    },
  });

  return ACCEPTANCE_MODULES.map((module) => {
    const latest = new Map<string, { outcome: AcceptanceOutcome; createdAt: Date }>();
    for (const record of records) {
      if (record.actionType !== module.actionType || !record.entityId || latest.has(record.entityId)) continue;
      const outcome = readOutcome(record.metadata);
      if (outcome) latest.set(record.entityId, { outcome, createdAt: record.createdAt });
    }
    const outcomes = Array.from(latest.values());
    const passed = outcomes.filter((item) => item.outcome === "PASS").length;
    const failed = outcomes.filter((item) => item.outcome === "FAIL").length;
    const deferred = outcomes.filter((item) => item.outcome === "DEFERRED").length;
    const recorded = outcomes.length;
    const missing = Math.max(0, module.totalSteps - recorded);
    const latestRecordedAt = outcomes.reduce<Date | null>((latestDate, item) => {
      if (!latestDate || item.createdAt > latestDate) return item.createdAt;
      return latestDate;
    }, null);

    return {
      key: module.key,
      label: module.label,
      totalSteps: module.totalSteps,
      passed,
      failed,
      deferred,
      missing,
      recorded,
      fullyPassed: passed === module.totalSteps && failed === 0 && deferred === 0 && missing === 0,
      latestRecordedAt: latestRecordedAt?.toISOString() ?? null,
    };
  });
}

function moduleState(input: {
  key: "LEADS" | "SERVICING" | "COMMISSIONS" | "FINANCE";
  gateEnabled: boolean;
  acceptanceFullyPassed?: boolean;
  schemaState?: "SOURCE_ALIGNED" | "PARTIAL_OR_MISSING" | "STAGED_ONLY" | "PARTIAL_OR_DRIFTED";
}): ProjectModuleState {
  if (input.key === "FINANCE") return "READINESS_ONLY";
  if (input.key === "LEADS") {
    if (input.gateEnabled && input.acceptanceFullyPassed) return "ACCEPTED";
    if (input.gateEnabled) return "CONTROLLED_TEST";
    return input.acceptanceFullyPassed ? "BUILT_GATED" : "STAGED_LOCKED";
  }
  if (input.schemaState === "PARTIAL_OR_MISSING" || input.schemaState === "PARTIAL_OR_DRIFTED") return "SCHEMA_DRIFT";
  if (input.key === "COMMISSIONS" && input.schemaState === "STAGED_ONLY") return "MIGRATION_STAGED";
  if (input.gateEnabled && input.acceptanceFullyPassed) return "ACCEPTED";
  if (input.gateEnabled) return "CONTROLLED_TEST";
  return "BUILT_GATED";
}

export async function getProjectReadinessSnapshot() {
  const deployment = getLeadDeploymentVerificationSnapshot();

  try {
    const [catalog, acceptance, unresolvedIntegrationErrors, failedWebhooks] = await Promise.all([
      readSchemaCatalog(),
      readAcceptanceSummary(),
      db.integrationError.count({ where: { resolved: false } }),
      db.webhookEvent.count({ where: { status: "ERROR" } }),
    ]);

    const acceptanceByKey = new Map(acceptance.map((item) => [item.key, item]));
    const leadsAcceptance = acceptanceByKey.get("LEADS");
    const servicingAcceptance = acceptanceByKey.get("SERVICING");
    const commissionAcceptance = acceptanceByKey.get("COMMISSIONS");

    const modules = [
      {
        key: "LEADS" as const,
        label: "Lead Flow",
        gateEnabled: features.leads,
        state: moduleState({ key: "LEADS", gateEnabled: features.leads, acceptanceFullyPassed: leadsAcceptance?.fullyPassed }),
        acceptance: leadsAcceptance ?? null,
        schemaState: "SOURCE_ALIGNED" as const,
        nextAction: leadsAcceptance?.fullyPassed
          ? "Monitor normal Lead Flow operations and integration errors; keep external workflow changes separately controlled."
          : "Complete and record the Lead Flow acceptance evidence before broadening normal use.",
      },
      {
        key: "SERVICING" as const,
        label: "Client Servicing",
        gateEnabled: features.servicing,
        state: moduleState({
          key: "SERVICING",
          gateEnabled: features.servicing,
          acceptanceFullyPassed: servicingAcceptance?.fullyPassed,
          schemaState: catalog.clientService.state,
        }),
        acceptance: servicingAcceptance ?? null,
        schemaState: catalog.clientService.state,
        nextAction: "Keep the gate closed until Hamilton authorizes a controlled Servicing acceptance window.",
      },
      {
        key: "COMMISSIONS" as const,
        label: "Commissions",
        gateEnabled: features.commissions,
        state: moduleState({
          key: "COMMISSIONS",
          gateEnabled: features.commissions,
          acceptanceFullyPassed: commissionAcceptance?.fullyPassed,
          schemaState: catalog.commission.state,
        }),
        acceptance: commissionAcceptance ?? null,
        schemaState: catalog.commission.state,
        nextAction:
          catalog.commission.state === "STAGED_ONLY"
            ? "The PR #100 migration is source-aligned and tested but unapplied. A production apply requires a new explicit Hamilton authorization before any Commission gate change."
            : catalog.commission.state === "SOURCE_ALIGNED"
              ? "Keep the gate closed until a separate owner-authorized Commission acceptance window."
              : "Stop and reconcile the partial or legacy schema before any Commission test or activation.",
      },
      {
        key: "FINANCE" as const,
        label: "Finance",
        gateEnabled: features.finance,
        state: moduleState({ key: "FINANCE", gateEnabled: features.finance }),
        acceptance: null,
        schemaState: "READINESS_ONLY" as const,
        nextAction: "Remain readiness-only. No payout execution or money movement is implemented or authorized.",
      },
    ];

    return {
      ok: true as const,
      version: PROJECT_READINESS_VERSION,
      generatedAt: new Date().toISOString(),
      deployment: {
        environment: deployment.environment,
        branch: deployment.branch,
        commitSha: deployment.commitSha,
        commitShort: deployment.commitShort,
        deploymentId: deployment.deploymentId,
      },
      features: { ...features },
      integrations: {
        unresolvedErrors: unresolvedIntegrationErrors,
        failedWebhooks,
      },
      schema: catalog,
      acceptance,
      modules,
      safetyBoundary:
        "Read-only project readiness snapshot. It does not apply migrations, change feature flags, mutate Leads or client records, call GHL, activate workflows, approve payouts, or move money.",
    };
  } catch (error) {
    console.error("[project-readiness] snapshot failed", error);
    return {
      ok: false as const,
      version: PROJECT_READINESS_VERSION,
      generatedAt: new Date().toISOString(),
      deployment: {
        environment: deployment.environment,
        branch: deployment.branch,
        commitSha: deployment.commitSha,
        commitShort: deployment.commitShort,
        deploymentId: deployment.deploymentId,
      },
      features: { ...features },
      error: "The readiness catalog could not be read. Review server logs; no mutation was attempted.",
      safetyBoundary:
        "Read-only project readiness snapshot. It does not apply migrations, change feature flags, mutate Leads or client records, call GHL, activate workflows, approve payouts, or move money.",
    };
  }
}
