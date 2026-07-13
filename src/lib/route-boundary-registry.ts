import "server-only";

import registryData from "../../config/route-boundary-registry.json";

export const ROUTE_BOUNDARY_REGISTRY_VERSION = registryData.version;

export type RouteBoundaryPrimitive =
  | "REQUEST_JSON"
  | "REQUEST_TEXT"
  | "DIRECT_NEXT_JSON"
  | "DIRECT_NEXT_RESPONSE"
  | "RAW_ERROR_MESSAGE";

export type RouteBoundaryClassification = "APPROVED_EXCEPTION" | "FROZEN_EXISTING";

export type RouteBoundaryFinding = {
  path: string;
  primitive: RouteBoundaryPrimitive;
  count: number;
  classification: RouteBoundaryClassification;
  rationale: string;
};

const findings = registryData.findings as RouteBoundaryFinding[];

function countBy<T extends string>(values: readonly T[]) {
  return values.reduce<Record<T, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {} as Record<T, number>);
}

export function getRouteBoundaryRegistrySnapshot() {
  const primitiveCounts = countBy(findings.map((finding) => finding.primitive));
  const classificationCounts = countBy(findings.map((finding) => finding.classification));
  const paths = [...new Set(findings.map((finding) => finding.path))].sort();

  return {
    ok: true,
    version: ROUTE_BOUNDARY_REGISTRY_VERSION,
    reviewedAt: registryData.reviewedAt,
    summary: {
      findingCount: findings.length,
      routeCount: paths.length,
      approvedExceptionCount: classificationCounts.APPROVED_EXCEPTION ?? 0,
      frozenExistingCount: classificationCounts.FROZEN_EXISTING ?? 0,
      primitiveCounts,
    },
    findings: [...findings].sort((left, right) =>
      `${left.path}:${left.primitive}`.localeCompare(`${right.path}:${right.primitive}`),
    ),
    safetyBoundary:
      "Source-derived registry only. It exposes reviewed route paths, primitive categories, counts, classifications, and rationales; it does not read request bodies, source contents, database records, credentials, customer data, or runtime payloads, and it performs no mutations.",
  };
}
