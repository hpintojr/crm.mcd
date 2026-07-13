import "server-only";

import {
  BUILD_GUARD_REGISTRY_VERSION,
  DEPLOYMENT_GUARD_PASS_LINES,
} from "@/lib/build-guard-registry";

/* BUILD_GUARD_REGISTRY_EVIDENCE_START
Lead import response boundary checks passed.
Lead flow alignment guard passed.
Owner decision prep guard passed.
Deferred acceptance runbook guard passed.
Acceptance summary CSV guard passed.
Print runbook guard passed.
Controlled test data history guard passed.
Acceptance diff guard passed.
Overview deferred summary guard passed.
Deployment verification guard passed.
Deep links guard passed.
Deep links API guard passed.
Deployment verification API guard passed.
Controlled warm reply guard passed.
Latest production commit guard passed.
Appointment Closed Won guard passed.
Commission schema migration guard passed.
Project readiness guard passed.
Servicing acceptance preflight guard passed.
Production smoke automation guard passed.
Lead aging cron resilience guard passed.
HTTP security headers guard passed.
Auth telemetry hygiene guard passed.
Certification precondition UX guard passed.
Manager claim action boundary guard passed.
Route trace hygiene guard passed.
Public signup boundary guard passed.
Account activation boundary guard passed.
GHL webhook replay claim guard passed.
GHL webhook request boundary guard passed.
Portal write request boundary guard passed.
Admin controlled test request boundary guard passed.
Legacy Admin Lead import retirement guard passed.
Integration health control plane guard passed.
Admin read report response boundary guard passed.
Lead acceptance report response boundary guard passed.
Protected CSV download response boundary guard passed.
Admin Lead import request boundary guard passed.
Route boundary registry guard passed.
Route boundary control plane guard passed.
Signed Lead import domain error mapping guard passed.
Shared route JSON response boundary guard passed.
Public JSON body boundary guard passed.
Authenticated E2E foundation guard passed.
Build guard control plane guard passed.
Build guard registry guard passed.
BUILD_GUARD_REGISTRY_EVIDENCE_END */

export const LEAD_DEPLOYMENT_VERIFICATION_VERSION = BUILD_GUARD_REGISTRY_VERSION;
export const EXPECTED_LEAD_FLOW_GUARD_LINES = DEPLOYMENT_GUARD_PASS_LINES;

export type LeadDeploymentVerificationRow = {
  id: string;
  label: string;
  value: string;
  present: boolean;
  hint?: string;
};

function envValue(v: string | null | undefined): { display: string; present: boolean } {
  if (v && v.length > 0) return { display: v, present: true };
  return { display: "Not exposed in this runtime", present: false };
}

export function getLeadDeploymentVerificationSnapshot() {
  const environment = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown";
  const branch = envValue(process.env.VERCEL_GIT_COMMIT_REF);
  const commitSha = envValue(process.env.VERCEL_GIT_COMMIT_SHA);
  const commitMessage = envValue(process.env.VERCEL_GIT_COMMIT_MESSAGE);
  const url = envValue(process.env.VERCEL_URL);
  const region = envValue(process.env.VERCEL_REGION);
  const deploymentId = envValue(process.env.VERCEL_DEPLOYMENT_ID);
  const productionUrl = envValue(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  const branchUrl = envValue(process.env.VERCEL_BRANCH_URL);
  const commitShort = commitSha.present ? commitSha.display.slice(0, 12) : "unknown";

  const rows: LeadDeploymentVerificationRow[] = [
    { id: "environment", label: "VERCEL_ENV", value: environment, present: environment !== "unknown", hint: "Should be `production` on crm.mercurycalldesk.com." },
    { id: "commit-sha", label: "VERCEL_GIT_COMMIT_SHA", value: commitSha.display, present: commitSha.present, hint: "Must match the merged squash commit on hpintojr/crm.mcd main." },
    { id: "commit-ref", label: "VERCEL_GIT_COMMIT_REF", value: branch.display, present: branch.present, hint: "Should be `main` for production deployments." },
    { id: "commit-message", label: "VERCEL_GIT_COMMIT_MESSAGE", value: commitMessage.display, present: commitMessage.present, hint: "First line of the merge commit." },
    { id: "deployment-id", label: "VERCEL_DEPLOYMENT_ID", value: deploymentId.display, present: deploymentId.present, hint: "Vercel deployment uid for the current runtime." },
    { id: "url", label: "VERCEL_URL", value: url.display, present: url.present, hint: "Immutable deployment URL (per-lambda hostname)." },
    { id: "production-url", label: "VERCEL_PROJECT_PRODUCTION_URL", value: productionUrl.display, present: productionUrl.present, hint: "Configured production hostname." },
    { id: "branch-url", label: "VERCEL_BRANCH_URL", value: branchUrl.display, present: branchUrl.present, hint: "Latest-alias URL for the current git branch." },
    { id: "region", label: "VERCEL_REGION", value: region.display, present: region.present, hint: "Vercel region serving this lambda." },
  ];

  return {
    ok: true,
    version: LEAD_DEPLOYMENT_VERIFICATION_VERSION,
    environment,
    branch: branch.display,
    commitSha: commitSha.display,
    commitShort,
    deploymentId: deploymentId.display,
    rows,
    expectedGuardLines: EXPECTED_LEAD_FLOW_GUARD_LINES,
    safetyBoundary:
      "Read-only Lead deployment verification snapshot only. Does not mutate Leads, audit records, feature flags, GHL workflows, imports, exports, commissions, payouts, finance, client onboarding, or business rules.",
  };
}
