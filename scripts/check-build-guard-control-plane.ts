import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function read(path: string) {
  return readFileSync(path, "utf8");
}

function assertContains(path: string, expected: string) {
  assert(read(path).includes(expected), `${path} is missing Build Guard Registry control-plane behavior: ${expected}`);
}

function assertExcludes(path: string, forbidden: string) {
  assert(!read(path).includes(forbidden), `${path} contains forbidden Build Guard Registry behavior: ${forbidden}`);
}

function checkSnapshot() {
  const path = "src/lib/build-guard-control-plane.ts";
  for (const expected of [
    'import "server-only"',
    "BUILD_GUARD_REGISTRY_REVIEWED_AT",
    "BUILD_GUARD_REGISTRY_VERSION",
    "BUILD_GUARDS",
    "getBuildGuardRegistrySnapshot",
    "order: index + 1",
    "guardCount: guards.length",
    "leadFlowGuardCount",
    "buildPreludeGuardCount",
    "deploymentVisibleCount",
    "does not execute guards, read source contents, query databases, inspect secrets, access customer data, invoke application endpoints, or perform mutations",
  ]) assertContains(path, expected);

  for (const forbidden of [
    'from "@/lib/db"',
    "readFileSync",
    "readdirSync",
    "spawnSync",
    "execSync",
    "request.",
    ".create(",
    ".update(",
    ".delete(",
    ".$transaction",
    "fetch(",
    "process.env",
    '"use server"',
  ]) assertExcludes(path, forbidden);
}

function checkApi() {
  const path = "src/app/api/admin/build-guards/route.ts";
  for (const expected of [
    'export const dynamic = "force-dynamic"',
    "authenticatedRequestId(request)",
    "requireRole(ADMIN_ROLES)",
    "getBuildGuardRegistrySnapshot()",
    "authenticatedJson",
    "viewedBy: { role: actor.role }",
  ]) assertContains(path, expected);

  for (const forbidden of [
    "NextResponse",
    "request.json()",
    "request.text()",
    "actor.id",
    "actor.email",
    'from "@/lib/db"',
    ".create(",
    ".update(",
    ".delete(",
    ".$transaction",
    "fetch(",
  ]) assertExcludes(path, forbidden);
}

function checkPage() {
  const path = "src/app/admin/build-guards/page.tsx";
  for (const expected of [
    'data-build-guard-registry="mcd-source-control-plane"',
    "requireRole(ADMIN_ROLES)",
    "getBuildGuardRegistrySnapshot()",
    "/api/admin/build-guards",
    "Registered guards",
    "Lead-flow execution",
    "Build prelude",
    "Deployment visible",
    "data-build-guard-entry={guard.id}",
    "snapshot.safetyBoundary",
    "actor.role",
  ]) assertContains(path, expected);

  for (const forbidden of [
    "actor.email",
    "readFileSync",
    "readdirSync",
    'from "@/lib/db"',
    ".create(",
    ".update(",
    ".delete(",
    ".$transaction",
    "revalidatePath",
    "fetch(",
    '"use server"',
  ]) assertExcludes(path, forbidden);
}

function checkManifest() {
  const registry = JSON.parse(read("config/build-guard-registry.json")) as {
    version: string;
    guards: Array<{ id: string; script: string; passLine: string; runInLeadFlow: boolean; exposeInDeploymentVerification: boolean }>;
  };
  assert(registry.version === "2026-07-13-pr132", "Build guard registry version must match PR132.");
  assert(registry.guards.length === 45, "Build guard registry must contain 45 entries after adding the control-plane guard.");
  assert(registry.guards.filter((guard) => guard.runInLeadFlow).length === 44,
    "Lead-flow runner must execute 44 guards after adding the control-plane guard.");
  const entry = registry.guards.find((guard) => guard.id === "build-guard-control-plane");
  assert(entry?.script === "scripts/check-build-guard-control-plane.ts", "Build guard control-plane script must be registered.");
  assert(entry?.passLine === "Build guard control plane guard passed.", "Build guard control-plane pass line must be registered.");
  assert(entry?.runInLeadFlow && entry.exposeInDeploymentVerification,
    "Build guard control-plane guard must run and remain deployment-visible.");
  assert(registry.guards.at(-1)?.id === "build-guard-registry",
    "Build guard registry self-check must remain last.");
}

function checkRepositoryContract() {
  for (const [path, expected] of [
    ["src/app/admin/settings/page.tsx", "/admin/build-guards"],
    ["docs/BUILD_GUARD_REGISTRY.md", "Protected control plane"],
    ["docs/INDEX.md", "/admin/build-guards"],
    ["docs/INDEX.md", "/api/admin/build-guards"],
    ["README.md", "/admin/build-guards"],
    ["package.json", '"check:build-guard-control-plane": "tsx scripts/check-build-guard-control-plane.ts"'],
    ["package.json", "scripts/check-build-guard-control-plane.ts"],
    ["src/lib/lead-deployment-verification.ts", "Build guard control plane guard passed."],
    ["scripts/check-deployment-verification-guard.ts", "Build guard control plane guard passed."],
  ] as const) assertContains(path, expected);
}

function main() {
  checkSnapshot();
  checkApi();
  checkPage();
  checkManifest();
  checkRepositoryContract();
  console.log("Build guard control plane guard passed.");
}

main();
