import "server-only";

import { db } from "@/lib/db";
import { allowedGhlLocations, env } from "@/lib/env";

export const INTEGRATION_HEALTH_VERSION = "2026-07-12-pr121";

export type IntegrationHealthState = "READY" | "ATTENTION_REQUIRED" | "CONFIGURATION_INCOMPLETE" | "READ_FAILED";
export type IntegrationTrafficState = "ACTIVE" | "QUIET";

type CountRow = { key: string; count: number };

const EVENT_CATEGORIES = ["appointments", "documents", "funding", "invoices", "opportunities", "replies", "other"] as const;
const ERROR_CATEGORIES = ["appointments", "documents", "funding", "invoices", "opportunities", "replies", "signup", "handoff", "other"] as const;

function eventCategory(value: string): (typeof EVENT_CATEGORIES)[number] {
  const normalized = value.toLowerCase();
  if (normalized.includes("appointment")) return "appointments";
  if (normalized.includes("document")) return "documents";
  if (normalized.includes("fund")) return "funding";
  if (normalized.includes("invoice")) return "invoices";
  if (normalized.includes("opportunity")) return "opportunities";
  if (normalized.includes("reply")) return "replies";
  return "other";
}

function errorCategory(value: string): (typeof ERROR_CATEGORIES)[number] {
  const normalized = value.toLowerCase();
  if (normalized.includes("appointment")) return "appointments";
  if (normalized.includes("document")) return "documents";
  if (normalized.includes("fund")) return "funding";
  if (normalized.includes("invoice")) return "invoices";
  if (normalized.includes("opportunity")) return "opportunities";
  if (normalized.includes("repl")) return "replies";
  if (normalized.includes("signup")) return "signup";
  if (normalized.includes("handoff")) return "handoff";
  return "other";
}

function countBy<T extends string>(keys: readonly T[], values: readonly T[]): CountRow[] {
  const counts = new Map<T, number>(keys.map((key) => [key, 0]));
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return keys.map((key) => ({ key, count: counts.get(key) ?? 0 }));
}

function iso(value: Date | null | undefined) {
  return value?.toISOString() ?? null;
}

export async function getIntegrationHealthSnapshot() {
  const generatedAt = new Date();
  const last24Hours = new Date(generatedAt.getTime() - 24 * 60 * 60 * 1000);

  try {
    const [
      events,
      unresolvedErrorCount,
      unresolvedErrorSources,
      resolvedErrorCount24h,
      latestReceived,
      latestProcessed,
      latestFailed,
      latestUnresolvedError,
    ] = await Promise.all([
      db.webhookEvent.findMany({
        where: { createdAt: { gte: last24Hours } },
        select: { type: true, status: true },
        orderBy: { createdAt: "desc" },
        take: 2000,
      }),
      db.integrationError.count({ where: { resolved: false } }),
      db.integrationError.findMany({
        where: { resolved: false },
        select: { source: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      db.integrationError.count({ where: { resolved: true, resolvedAt: { gte: last24Hours } } }),
      db.webhookEvent.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      db.webhookEvent.findFirst({ where: { processedAt: { not: null } }, orderBy: { processedAt: "desc" }, select: { processedAt: true } }),
      db.webhookEvent.findFirst({ where: { status: "ERROR" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      db.integrationError.findFirst({ where: { resolved: false }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    ]);

    const statusValues = events.map((event) => {
      const normalized = event.status.trim().toUpperCase();
      return normalized === "PROCESSED" || normalized === "ERROR" || normalized === "RECEIVED" ? normalized : "OTHER";
    });
    const processed24h = statusValues.filter((status) => status === "PROCESSED").length;
    const failed24h = statusValues.filter((status) => status === "ERROR").length;
    const received24h = statusValues.filter((status) => status === "RECEIVED").length;
    const other24h = statusValues.filter((status) => status === "OTHER").length;

    const webhookSecretConfigured = Boolean(env.ghl.webhookSecret);
    const approvedLocationCount = allowedGhlLocations().size;
    const inboundConfigurationReady = webhookSecretConfigured && approvedLocationCount > 0;
    const outboundConfigurationReady = Boolean(env.ghl.token && env.ghl.salesHqLocationId);
    const state: IntegrationHealthState = !inboundConfigurationReady
      ? "CONFIGURATION_INCOMPLETE"
      : failed24h > 0 || unresolvedErrorCount > 0
        ? "ATTENTION_REQUIRED"
        : "READY";

    return {
      ok: true as const,
      version: INTEGRATION_HEALTH_VERSION,
      generatedAt: generatedAt.toISOString(),
      state,
      trafficState: events.length > 0 ? ("ACTIVE" as IntegrationTrafficState) : ("QUIET" as IntegrationTrafficState),
      deployment: {
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
        branch: process.env.VERCEL_GIT_COMMIT_REF ?? "unknown",
        commitShort: (process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown").slice(0, 12),
      },
      configuration: {
        inboundConfigurationReady,
        webhookSecretConfigured,
        approvedLocationCount,
        outboundConfigurationReady,
        privateTokenConfigured: Boolean(env.ghl.token),
        salesHqLocationConfigured: Boolean(env.ghl.salesHqLocationId),
        miniCrmLeadFieldConfigured: Boolean(env.ghl.miniCrmLeadIdFieldId),
      },
      webhooks: {
        windowHours: 24,
        total24h: events.length,
        processed24h,
        failed24h,
        received24h,
        other24h,
        byCategory: countBy(EVENT_CATEGORIES, events.map((event) => eventCategory(event.type))),
        latestReceivedAt: iso(latestReceived?.createdAt),
        latestProcessedAt: iso(latestProcessed?.processedAt),
        latestFailedAt: iso(latestFailed?.createdAt),
      },
      errors: {
        unresolvedTotal: unresolvedErrorCount,
        sampledUnresolved: unresolvedErrorSources.length,
        resolved24h: resolvedErrorCount24h,
        byCategory: countBy(ERROR_CATEGORIES, unresolvedErrorSources.map((error) => errorCategory(error.source))),
        latestUnresolvedAt: iso(latestUnresolvedError?.createdAt),
      },
      privacy: {
        aggregateOnly: true,
        includesPayloads: false,
        includesEventIds: false,
        includesLocationIds: false,
        includesMessages: false,
        includesReferences: false,
        includesContactData: false,
      },
      safetyBoundary:
        "Read-only aggregate integration health only. Selects webhook type/status timestamps and IntegrationError source/resolution state only. Never selects or returns payloads, event IDs, location IDs, messages, references, Leads, Agents, emails, phone numbers, customer identifiers, credentials, or secret values. Does not resolve, replay, preview, apply, send, or mutate anything.",
    };
  } catch (error) {
    return {
      ok: false as const,
      version: INTEGRATION_HEALTH_VERSION,
      generatedAt: generatedAt.toISOString(),
      state: "READ_FAILED" as const,
      error: error instanceof Error ? error.name : "IntegrationHealthReadError",
      privacy: {
        aggregateOnly: true,
        includesPayloads: false,
        includesEventIds: false,
        includesLocationIds: false,
        includesMessages: false,
        includesReferences: false,
        includesContactData: false,
      },
      safetyBoundary:
        "Read-only aggregate integration health only. A read failure is reported by error class name only; raw database messages are not exposed.",
    };
  }
}
