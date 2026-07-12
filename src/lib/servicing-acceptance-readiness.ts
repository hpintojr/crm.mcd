import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { features } from "@/lib/features";

export const SERVICING_ACCEPTANCE_READINESS_VERSION = "2026-07-12-pr102";

export const SERVICING_SCHEMA_TABLES = [
  "ClientAccount",
  "ClientServiceActivity",
  "ClientServiceCase",
  "ClientServiceAssignmentEvent",
] as const;

export const SERVICING_ACCEPTANCE_STEPS = [
  {
    id: "controlled-test-setup",
    title: "1. Confirm controlled test setup",
    detail: "Use test Client Accounts and an approved test owner. Keep Commission and Finance disabled; this test validates service handling only.",
    href: "/admin/operating-status",
    action: "Review gate state",
  },
  {
    id: "client-account",
    title: "2. Create a test Client Account",
    detail: "Use a Closed Won test Lead in the onboarding queue. Confirm one Client Account is created and retains the Lead, originating owner, and GHL identity context.",
    href: "/admin/servicing/onboarding",
    action: "Open onboarding",
  },
  {
    id: "launch",
    title: "3. Document launch",
    detail: "Complete the launch checklist. Confirm the account becomes Active when current on payments, or Payment Failed when a payment issue exists. No commission or payout should be created.",
    href: "/admin/servicing/launches",
    action: "Open launch confirmations",
  },
  {
    id: "healthy-account-protection",
    title: "4. Validate healthy-account protection",
    detail: "Keep a current-paying test Client Account quiet. Confirm that lack of routine activity alone does not create a case, reassign the account, or alter service ownership.",
    href: "/admin/servicing",
    action: "Open servicing workspace",
  },
  {
    id: "triggered-service-work",
    title: "5. Validate triggered service work",
    detail: "Create documented work for a real trigger: client request, support issue, payment problem, renewal event, escalation, or documented review. Confirm a Service Case appears with the expected priority and due time.",
    href: "/admin/servicing/cases",
    action: "Open service cases",
  },
  {
    id: "case-resolution",
    title: "6. Validate case resolution",
    detail: "Record the action and resolution. Confirm the case history remains available and the Client Account health reflects the documented result.",
    href: "/admin/servicing/cases",
    action: "Open case queue",
  },
  {
    id: "house-handling",
    title: "7. Validate reassignment / House handling",
    detail: "Use only a test account. Confirm a documented transfer preserves history and that the account moves to House only through an authorized servicing decision—not because a healthy account is quiet.",
    href: "/admin/servicing",
    action: "Open servicing workspace",
  },
  {
    id: "hard-boundaries",
    title: "8. Confirm hard boundaries",
    detail: "Verify this workflow does not create a commission, approve a payout, collect a payment, store bank data, or invoke Finance execution.",
    href: "/admin/finance",
    action: "Open Finance readiness",
  },
  {
    id: "owner-decision",
    title: "9. Record owner decision",
    detail: "Keep normal servicing access gated until every test passes or any exception has an owner-approved remediation plan.",
    href: "/admin/audit",
    action: "Open audit history",
  },
] as const;

type Outcome = "PASS" | "FAIL" | "DEFERRED";
type SchemaRow = { name: string };
type MetricRow = { metric: string; value: number };

type LatestAcceptance = {
  outcome: Outcome;
  reason: string | null;
  createdAt: Date;
};

export type ServicingReadinessDecision =
  | "BLOCKED_SCHEMA"
  | "BLOCKED_LEAD_ACCEPTANCE"
  | "UNSAFE_GATE_COMBINATION"
  | "OWNER_AUTHORIZATION_REQUIRED"
  | "CONTROLLED_WINDOW_OPEN";

function outcomeFromMetadata(metadata: unknown): Outcome | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const outcome = (metadata as { outcome?: unknown }).outcome;
  return outcome === "PASS" || outcome === "FAIL" || outcome === "DEFERRED" ? outcome : null;
}

function latestByStep(
  records: Array<{ entityId: string | null; metadata: unknown; reason: string | null; createdAt: Date }>,
) {
  const latest = new Map<string, LatestAcceptance>();
  for (const record of records) {
    if (!record.entityId || latest.has(record.entityId)) continue;
    const outcome = outcomeFromMetadata(record.metadata);
    if (!outcome) continue;
    latest.set(record.entityId, { outcome, reason: record.reason, createdAt: record.createdAt });
  }
  return latest;
}

function summarizeAcceptance(
  steps: readonly { id: string; title: string; detail: string; href: string; action: string }[],
  latest: Map<string, LatestAcceptance>,
) {
  const results = steps.map((step) => {
    const record = latest.get(step.id) ?? null;
    return {
      ...step,
      outcome: record?.outcome ?? null,
      note: record?.reason ?? null,
      recordedAt: record?.createdAt.toISOString() ?? null,
    };
  });
  const passed = results.filter((item) => item.outcome === "PASS").length;
  const failed = results.filter((item) => item.outcome === "FAIL").length;
  const deferred = results.filter((item) => item.outcome === "DEFERRED").length;
  const missing = results.filter((item) => item.outcome === null).length;
  return {
    total: steps.length,
    passed,
    failed,
    deferred,
    missing,
    fullyPassed: passed === steps.length && failed === 0 && deferred === 0 && missing === 0,
    steps: results,
  };
}

function metricMap(rows: MetricRow[]) {
  return new Map(rows.map((row) => [row.metric, row.value]));
}

async function readSchemaState() {
  const rows = await db.$queryRaw<SchemaRow[]>(Prisma.sql`
    SELECT table_name AS "name"
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'ClientAccount',
        'ClientServiceActivity',
        'ClientServiceCase',
        'ClientServiceAssignmentEvent'
      )
    ORDER BY table_name
  `);
  const presentSet = new Set(rows.map((row) => row.name));
  const presentTables = SERVICING_SCHEMA_TABLES.filter((name) => presentSet.has(name));
  const missingTables = SERVICING_SCHEMA_TABLES.filter((name) => !presentSet.has(name));
  return {
    expectedTables: [...SERVICING_SCHEMA_TABLES],
    presentTables,
    missingTables,
    sourceAligned: missingTables.length === 0,
  };
}

async function readQueueMetrics() {
  const rows = await db.$queryRaw<MetricRow[]>(Prisma.sql`
    WITH metrics AS (
      SELECT 'onboardingCandidates'::text AS metric, COUNT(*)::int AS value
      FROM "Lead" lead
      LEFT JOIN "ClientAccount" account ON account."leadId" = lead."id"
      WHERE lead."lifecycle" = 'CLOSED_WON'::"LeadLifecycle"
        AND lead."dnc" = false
        AND lead."suppressed" = false
        AND account."id" IS NULL

      UNION ALL
      SELECT 'clientAccounts', COUNT(*)::int FROM "ClientAccount"

      UNION ALL
      SELECT 'pendingLaunch', COUNT(*)::int
      FROM "ClientAccount"
      WHERE "status" = 'PENDING_LAUNCH'::"ClientAccountStatus"
        AND "launchChecklistComplete" = false

      UNION ALL
      SELECT 'activeAccounts', COUNT(*)::int
      FROM "ClientAccount"
      WHERE "status" = 'ACTIVE'::"ClientAccountStatus"

      UNION ALL
      SELECT 'healthyCurrentAccounts', COUNT(*)::int
      FROM "ClientAccount"
      WHERE "healthStatus" = 'HEALTHY'::"ClientHealthStatus"
        AND "currentOnPayments" = true

      UNION ALL
      SELECT 'paymentAttentionAccounts', COUNT(*)::int
      FROM "ClientAccount"
      WHERE "currentOnPayments" = false
         OR "healthStatus" IN ('PAYMENT_FAILED'::"ClientHealthStatus", 'AT_RISK'::"ClientHealthStatus", 'NEEDS_ATTENTION'::"ClientHealthStatus")

      UNION ALL
      SELECT 'houseOrUnassignedAccounts', COUNT(*)::int
      FROM "ClientAccount"
      WHERE "status" = 'HOUSE'::"ClientAccountStatus"
         OR "accountOwnerAgentId" IS NULL

      UNION ALL
      SELECT 'openCases', COUNT(*)::int
      FROM "ClientServiceCase"
      WHERE "status" IN ('OPEN'::"ClientServiceCaseStatus", 'IN_PROGRESS'::"ClientServiceCaseStatus", 'WAITING_ON_CLIENT'::"ClientServiceCaseStatus")

      UNION ALL
      SELECT 'overdueCases', COUNT(*)::int
      FROM "ClientServiceCase"
      WHERE "status" IN ('OPEN'::"ClientServiceCaseStatus", 'IN_PROGRESS'::"ClientServiceCaseStatus", 'WAITING_ON_CLIENT'::"ClientServiceCaseStatus")
        AND "dueAt" IS NOT NULL
        AND "dueAt" < NOW()

      UNION ALL
      SELECT 'urgentHighCases', COUNT(*)::int
      FROM "ClientServiceCase"
      WHERE "status" IN ('OPEN'::"ClientServiceCaseStatus", 'IN_PROGRESS'::"ClientServiceCaseStatus", 'WAITING_ON_CLIENT'::"ClientServiceCaseStatus")
        AND "priority" IN ('URGENT'::"ClientServicePriority", 'HIGH'::"ClientServicePriority")

      UNION ALL
      SELECT 'serviceActivities', COUNT(*)::int FROM "ClientServiceActivity"

      UNION ALL
      SELECT 'assignmentEvents', COUNT(*)::int FROM "ClientServiceAssignmentEvent"
    )
    SELECT metric, value FROM metrics ORDER BY metric
  `);
  const metrics = metricMap(rows);
  return {
    onboardingCandidates: metrics.get("onboardingCandidates") ?? 0,
    clientAccounts: metrics.get("clientAccounts") ?? 0,
    pendingLaunch: metrics.get("pendingLaunch") ?? 0,
    activeAccounts: metrics.get("activeAccounts") ?? 0,
    healthyCurrentAccounts: metrics.get("healthyCurrentAccounts") ?? 0,
    paymentAttentionAccounts: metrics.get("paymentAttentionAccounts") ?? 0,
    houseOrUnassignedAccounts: metrics.get("houseOrUnassignedAccounts") ?? 0,
    openCases: metrics.get("openCases") ?? 0,
    overdueCases: metrics.get("overdueCases") ?? 0,
    urgentHighCases: metrics.get("urgentHighCases") ?? 0,
    serviceActivities: metrics.get("serviceActivities") ?? 0,
    assignmentEvents: metrics.get("assignmentEvents") ?? 0,
  };
}

function determineDecision(input: {
  schemaAligned: boolean;
  leadAcceptancePassed: boolean;
  servicingEnabled: boolean;
  commissionsEnabled: boolean;
  financeEnabled: boolean;
}): ServicingReadinessDecision {
  if (!input.schemaAligned) return "BLOCKED_SCHEMA";
  if (!input.leadAcceptancePassed) return "BLOCKED_LEAD_ACCEPTANCE";
  if (input.commissionsEnabled || input.financeEnabled) return "UNSAFE_GATE_COMBINATION";
  if (!input.servicingEnabled) return "OWNER_AUTHORIZATION_REQUIRED";
  return "CONTROLLED_WINDOW_OPEN";
}

export async function getServicingAcceptanceReadinessSnapshot() {
  const schema = await readSchemaState();
  const records = await db.auditLog.findMany({
    where: {
      OR: [
        { actionType: "LEAD_PRODUCTION_ACCEPTANCE_RECORDED", entityType: "LeadProductionAcceptanceStep" },
        { actionType: "SERVICING_ACCEPTANCE_RECORDED", entityType: "ServicingAcceptanceStep" },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
    select: { actionType: true, entityId: true, metadata: true, reason: true, createdAt: true },
  });

  const leadRecords = records.filter((record) => record.actionType === "LEAD_PRODUCTION_ACCEPTANCE_RECORDED");
  const servicingRecords = records.filter((record) => record.actionType === "SERVICING_ACCEPTANCE_RECORDED");
  const leadLatest = latestByStep(leadRecords);
  const servicingLatest = latestByStep(servicingRecords);
  const leadOutcomes = Array.from(leadLatest.values());
  const leadAcceptance = {
    total: 18,
    passed: leadOutcomes.filter((item) => item.outcome === "PASS").length,
    failed: leadOutcomes.filter((item) => item.outcome === "FAIL").length,
    deferred: leadOutcomes.filter((item) => item.outcome === "DEFERRED").length,
  };
  const leadAcceptanceFullyPassed =
    leadAcceptance.passed === leadAcceptance.total && leadAcceptance.failed === 0 && leadAcceptance.deferred === 0;
  const servicingAcceptance = summarizeAcceptance(SERVICING_ACCEPTANCE_STEPS, servicingLatest);
  const queues = schema.sourceAligned ? await readQueueMetrics() : null;
  const gates = {
    leads: features.leads,
    servicing: features.servicing,
    commissions: features.commissions,
    finance: features.finance,
  };
  const decision = determineDecision({
    schemaAligned: schema.sourceAligned,
    leadAcceptancePassed: leadAcceptanceFullyPassed,
    servicingEnabled: gates.servicing,
    commissionsEnabled: gates.commissions,
    financeEnabled: gates.finance,
  });

  const checks = [
    {
      id: "schema",
      label: "Client/Service schema",
      passed: schema.sourceAligned,
      detail: schema.sourceAligned
        ? "All four required Client/Service tables are present."
        : `Missing: ${schema.missingTables.join(", ") || "unknown"}.`,
    },
    {
      id: "lead-acceptance",
      label: "Lead Flow prerequisite",
      passed: leadAcceptanceFullyPassed,
      detail: `${leadAcceptance.passed} of ${leadAcceptance.total} Lead Flow acceptance steps are currently PASS.`,
    },
    {
      id: "financial-separation",
      label: "Commission and Finance separation",
      passed: !gates.commissions && !gates.finance,
      detail: !gates.commissions && !gates.finance
        ? "Commission and Finance gates are closed."
        : "Commission or Finance is enabled; do not open a Servicing acceptance window in this combination.",
    },
    {
      id: "controlled-input",
      label: "Controlled onboarding input",
      passed: Boolean(queues && queues.onboardingCandidates > 0),
      detail: queues
        ? `${queues.onboardingCandidates} verified Closed Won Lead${queues.onboardingCandidates === 1 ? " is" : "s are"} available without an existing Client Account.`
        : "Queue metrics are unavailable until the schema is aligned.",
    },
    {
      id: "owner-window",
      label: "Owner-authorized test window",
      passed: gates.servicing,
      detail: gates.servicing
        ? "The Servicing gate is enabled for a controlled window."
        : "The Servicing gate remains closed; explicit Hamilton authorization is still required.",
    },
  ];

  return {
    ok: true as const,
    version: SERVICING_ACCEPTANCE_READINESS_VERSION,
    generatedAt: new Date().toISOString(),
    decision,
    gates,
    schema,
    leadAcceptance: { ...leadAcceptance, fullyPassed: leadAcceptanceFullyPassed },
    servicingAcceptance,
    queues,
    checks,
    safetyBoundary:
      "Read-only Servicing acceptance preflight. It does not enable the Servicing gate, create or launch a Client Account, create or resolve a Service Case, record acceptance outcomes, call GHL, create Commission records, approve Finance, or move money.",
  };
}
