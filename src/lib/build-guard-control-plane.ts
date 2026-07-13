import "server-only";

import {
  BUILD_GUARD_REGISTRY_REVIEWED_AT,
  BUILD_GUARD_REGISTRY_VERSION,
  BUILD_GUARDS,
} from "@/lib/build-guard-registry";

export function getBuildGuardRegistrySnapshot() {
  const guards = BUILD_GUARDS.map((guard, index) => ({
    order: index + 1,
    id: guard.id,
    script: guard.script,
    passLine: guard.passLine,
    runInLeadFlow: guard.runInLeadFlow,
    exposeInDeploymentVerification: guard.exposeInDeploymentVerification,
  }));

  return {
    ok: true,
    version: BUILD_GUARD_REGISTRY_VERSION,
    reviewedAt: BUILD_GUARD_REGISTRY_REVIEWED_AT,
    summary: {
      guardCount: guards.length,
      leadFlowGuardCount: guards.filter((guard) => guard.runInLeadFlow).length,
      buildPreludeGuardCount: guards.filter((guard) => !guard.runInLeadFlow).length,
      deploymentVisibleCount: guards.filter((guard) => guard.exposeInDeploymentVerification).length,
    },
    guards,
    safetyBoundary:
      "Static build-guard manifest metadata only. It exposes reviewed guard order, IDs, local script paths, pass lines, execution membership, and deployment visibility; it does not execute guards, read source contents, query databases, inspect secrets, access customer data, invoke application endpoints, or perform mutations.",
  };
}
