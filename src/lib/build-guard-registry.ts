import registryData from "../../config/build-guard-registry.json";

export type BuildGuardDefinition = {
  id: string;
  script: string;
  passLine: string;
  runInLeadFlow: boolean;
  exposeInDeploymentVerification: boolean;
};

export const BUILD_GUARD_REGISTRY_VERSION = registryData.version;
export const BUILD_GUARD_REGISTRY_REVIEWED_AT = registryData.reviewedAt;
export const BUILD_GUARDS = registryData.guards as BuildGuardDefinition[];
export const LEAD_FLOW_BUILD_GUARDS = BUILD_GUARDS.filter((guard) => guard.runInLeadFlow);
export const DEPLOYMENT_GUARD_PASS_LINES = BUILD_GUARDS
  .filter((guard) => guard.exposeInDeploymentVerification)
  .map((guard) => guard.passLine);
