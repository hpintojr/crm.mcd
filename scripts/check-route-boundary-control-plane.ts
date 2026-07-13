import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function read(path: string) {
  return readFileSync(path, "utf8");
}

function assertContains(path: string, expected: string) {
  assert(read(path).includes(expected), `${path} is missing Route Boundary Registry behavior: ${expected}`);
}

function checkRegistry() {
  const registry = JSON.parse(read("config/route-boundary-registry.json")) as {
    version: string;
    reviewedAt: string;
    findings: Array<{ path: string; primitive: string; count: number; classification: string; rationale: string }>;
  };

  assert(registry.version === "2026-07-13-pr129", "Route boundary registry version must match PR129.");
  assert(registry.reviewedAt === "2026-07-13", "Route boundary review date must be explicit.");
  assert(registry.findings.length === 2, "Route boundary baseline must contain the 2 source-derived findings.");
  assert(registry.findings.every((finding) => finding.classification === "APPROVED_EXCEPTION"),
    "Every current finding must be explicitly reviewed as an approved exception.");
  assert(registry.findings.every((finding) => finding.rationale.trim().length > 20),
    "Every route boundary finding needs a meaningful rationale.");
  assert(registry.findings.every((finding) => finding.primitive === "REQUEST_TEXT"),
    "Only required bounded raw-body reads may remain in the current registry.");
}

function checkSnapshot() {
  const path = "src/lib/route-boundary-registry.ts";
  const content = read(path);
  for (const expected of [
    'import registryData from "../../config/route-boundary-registry.json"',
    "getRouteBoundaryRegistrySnapshot",
    "findingCount: findings.length",
    "routeCount: paths.length",
    "approvedExceptionCount",
    "frozenExistingCount",
    "primitiveCounts",
    "does not read request bodies, source contents, database records, credentials, customer data, or runtime payloads",
  ]) assertContains(path, expected);

  for (const forbidden of [
    'from "@/lib/db"',
    "readFileSync",
    "readdirSync",
    "request.",
    ".create(",
    ".update(",
    ".delete(",
    ".$transaction",
    "revalidatePath",
    '"use server"',
  ]) assert(!content.includes(forbidden), `${path} contains forbidden runtime source, request, database, or mutation behavior: ${forbidden}`);
}

function checkApi() {
  const path = "src/app/api/admin/route-boundaries/route.ts";
  const content = read(path);
  for (const expected of [
    'export const dynamic = "force-dynamic"',
    "authenticatedRequestId(request)",
    "requireRole(ADMIN_ROLES)",
    "getRouteBoundaryRegistrySnapshot()",
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
  ]) assert(!content.includes(forbidden), `${path} contains forbidden direct response, body, identity, database, or mutation behavior: ${forbidden}`);
}

function checkPage() {
  const path = "src/app/admin/route-boundaries/page.tsx";
  const content = read(path);
  for (const expected of [
    'data-route-boundary-registry="mcd-source-control-plane"',
    "requireRole(ADMIN_ROLES)",
    "getRouteBoundaryRegistrySnapshot()",
    "/api/admin/route-boundaries",
    "Reviewed findings",
    "Frozen debt",
    "data-route-boundary-finding=",
    "snapshot.safetyBoundary",
  ]) assertContains(path, expected);

  for (const forbidden of [
    "readFileSync",
    "readdirSync",
    'from "@/lib/db"',
    ".create(",
    ".update(",
    ".delete(",
    ".$transaction",
    "revalidatePath",
    '"use server"',
  ]) assert(!content.includes(forbidden), `${path} contains forbidden runtime source, database, or mutation behavior: ${forbidden}`);
}

function checkRepositoryContract() {
  for (const [path, expected] of [
    ["scripts/check-route-boundary-registry.ts", "Route boundary registry guard passed."],
    ["scripts/check-route-boundary-registry.ts", "Route boundary registry drift detected."],
    ["scripts/check-route-boundary-registry.ts", "APPROVED_CLASSIFICATIONS"],
    ["src/app/admin/settings/page.tsx", "/admin/route-boundaries"],
    ["docs/ROUTE_BOUNDARY_REGISTRY.md", "Source-derived inventory"],
    ["docs/ROUTE_BOUNDARY_REGISTRY.md", "2 approved findings"],
    ["docs/ROUTE_BOUNDARY_REGISTRY.md", "do not invoke any route"],
    ["docs/INDEX.md", "ROUTE_BOUNDARY_REGISTRY.md"],
    ["package.json", '"check:route-boundary-registry": "tsx scripts/check-route-boundary-registry.ts"'],
    ["package.json", '"check:route-boundary-control-plane": "tsx scripts/check-route-boundary-control-plane.ts"'],
    ["package.json", "check-route-boundary-control-plane.ts"],
    ["src/lib/lead-deployment-verification.ts", "Route boundary registry guard passed."],
    ["src/lib/lead-deployment-verification.ts", "Route boundary control plane guard passed."],
    ["scripts/check-deployment-verification-guard.ts", "Route boundary registry guard passed."],
    ["scripts/check-deployment-verification-guard.ts", "Route boundary control plane guard passed."],
  ] as const) assertContains(path, expected);
}

function main() {
  checkRegistry();
  checkSnapshot();
  checkApi();
  checkPage();
  checkRepositoryContract();
  console.log("Route boundary control plane guard passed.");
}

main();
