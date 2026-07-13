import { existsSync, readFileSync } from "node:fs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function read(path: string) {
  return readFileSync(path, "utf8");
}

type Guard = {
  id: string;
  script: string;
  passLine: string;
  runInLeadFlow: boolean;
  exposeInDeploymentVerification: boolean;
};

type Registry = {
  version: string;
  reviewedAt: string;
  guards: Guard[];
};

function checkManifest() {
  const registry = JSON.parse(read("config/build-guard-registry.json")) as Registry;
  assert(registry.version === "2026-07-13-pr131", "Build guard registry version must match PR131.");
  assert(registry.reviewedAt === "2026-07-13", "Build guard registry review date must be explicit.");
  assert(registry.guards.length === 44, "Build guard registry must contain the exact 44 deployment-visible guards.");
  assert(registry.guards.filter((guard) => guard.runInLeadFlow).length === 43,
    "Lead-flow runner must preserve the exact 43-guard execution chain.");
  assert(registry.guards.every((guard) => guard.exposeInDeploymentVerification),
    "Every registered guard must remain visible in deployment verification.");

  const ids = new Set<string>();
  const scripts = new Set<string>();
  const passLines = new Set<string>();
  for (const guard of registry.guards) {
    assert(/^[a-z0-9-]+$/.test(guard.id), `Invalid build guard id: ${guard.id}`);
    assert(!ids.has(guard.id), `Duplicate build guard id: ${guard.id}`);
    ids.add(guard.id);

    assert(/^scripts\/check-[a-z0-9-]+\.ts$/.test(guard.script), `Unsafe build guard script path: ${guard.script}`);
    assert(!scripts.has(guard.script), `Duplicate build guard script: ${guard.script}`);
    scripts.add(guard.script);
    assert(existsSync(guard.script), `Registered build guard script does not exist: ${guard.script}`);

    assert(guard.passLine.endsWith("passed."), `Build guard pass line must end in "passed.": ${guard.id}`);
    assert(!passLines.has(guard.passLine), `Duplicate build guard pass line: ${guard.passLine}`);
    passLines.add(guard.passLine);
    assert(read(guard.script).includes(guard.passLine), `${guard.script} does not emit its registered pass line.`);
  }

  const first = registry.guards[0];
  assert(first.id === "lead-import-response-contract" && !first.runInLeadFlow,
    "Lead-import response evidence must remain build-prelude-only and first in deployment verification.");
  const last = registry.guards.at(-1);
  assert(last?.id === "build-guard-registry" && last.runInLeadFlow,
    "Build guard registry self-validation must remain the final lead-flow guard.");
}

function checkRunner() {
  const path = "scripts/run-build-guards.ts";
  const content = read(path);
  for (const expected of [
    "LEAD_FLOW_BUILD_GUARDS",
    "spawnSync(process.execPath",
    '["--import", "tsx", guard.script]',
    "cwd: process.cwd()",
    "env: process.env",
    "result.status !== 0",
    "output.includes(guard.passLine)",
    "for (const guard of LEAD_FLOW_BUILD_GUARDS) runGuard(guard)",
  ]) assert(content.includes(expected), `${path} is missing build-guard runner behavior: ${expected}`);

  for (const forbidden of [
    "execSync",
    "exec(",
    "shell: true",
    "eval(",
    "DATABASE_URL",
    "DIRECT_URL",
    "AUTH_SECRET",
    "CRON_SECRET",
    "VERCEL_TOKEN",
  ]) assert(!content.includes(forbidden), `${path} contains forbidden shell or secret-specific behavior: ${forbidden}`);
}

function checkRepositoryWiring() {
  const packageJson = read("package.json");
  assert(packageJson.includes('"check:lead-flow-alignment": "tsx scripts/run-build-guards.ts"'),
    "package.json must route lead-flow verification through the manifest runner.");
  assert(packageJson.includes('"check:build-guard-registry": "tsx scripts/check-build-guard-registry.ts"'),
    "package.json must expose the build guard registry check.");
  assert(!packageJson.includes('"check:lead-flow-alignment": "tsx scripts/check-lead-flow-alignment.ts &&'),
    "package.json must not retain the duplicated lead-flow shell chain.");

  const registryLib = read("src/lib/build-guard-registry.ts");
  for (const expected of [
    'import registryData from "../../config/build-guard-registry.json"',
    "LEAD_FLOW_BUILD_GUARDS",
    "DEPLOYMENT_GUARD_PASS_LINES",
  ]) assert(registryLib.includes(expected), `Build guard registry library is missing: ${expected}`);

  const deployment = read("src/lib/lead-deployment-verification.ts");
  assert(deployment.includes("DEPLOYMENT_GUARD_PASS_LINES"),
    "Deployment verification must derive pass lines from the build guard registry.");
  assert(!deployment.includes('"Lead flow alignment guard passed."'),
    "Deployment verification must not retain a copied pass-line array.");

  const deploymentGuard = read("scripts/check-deployment-verification-guard.ts");
  assert(deploymentGuard.includes('config/build-guard-registry.json'),
    "Deployment verification guard must validate the source manifest.");
  assert(!deploymentGuard.includes('const expectedGuardLines = ['),
    "Deployment verification guard must not retain a copied pass-line array.");

  for (const [path, expected] of [
    ["docs/BUILD_GUARD_REGISTRY.md", "Single source of truth"],
    ["docs/BUILD_GUARD_REGISTRY.md", "does not run application endpoints"],
    ["docs/INDEX.md", "BUILD_GUARD_REGISTRY.md"],
    ["src/lib/lead-deployment-verification.ts", "Build guard registry guard passed."],
    ["scripts/check-deployment-verification-guard.ts", "Build guard registry guard passed."],
  ] as const) assert(read(path).includes(expected), `${path} is missing build guard registry evidence: ${expected}`);
}

function main() {
  checkManifest();
  checkRunner();
  checkRepositoryWiring();
  console.log("Build guard registry guard passed.");
}

main();
