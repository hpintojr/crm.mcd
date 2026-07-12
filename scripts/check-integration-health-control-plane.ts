import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function read(path: string) {
  return readFileSync(path, "utf8");
}

function assertContains(path: string, expected: string) {
  assert(read(path).includes(expected), `${path} is missing Integration Health contract: ${expected}`);
}

function checkSnapshot() {
  const path = "src/lib/integration-health.ts";
  const content = read(path);

  for (const expected of [
    'import "server-only"',
    'INTEGRATION_HEALTH_VERSION = "2026-07-12-pr121"',
    "getIntegrationHealthSnapshot",
    'select: { type: true, status: true }',
    'select: { source: true }',
    'select: { createdAt: true }',
    'select: { processedAt: true }',
    'take: 2000',
    'take: 500',
    '"READY"',
    '"ATTENTION_REQUIRED"',
    '"CONFIGURATION_INCOMPLETE"',
    '"READ_FAILED"',
    "allowedGhlLocations().size",
    "webhookSecretConfigured: Boolean(env.ghl.webhookSecret)",
    "aggregateOnly: true",
    "includesPayloads: false",
    "includesEventIds: false",
    "includesLocationIds: false",
    "includesMessages: false",
    "includesReferences: false",
    "includesContactData: false",
    "error instanceof Error ? error.name",
  ]) {
    assert(content.includes(expected), `${path} is missing aggregate snapshot behavior: ${expected}`);
  }

  for (const forbidden of [
    "payload: true",
    "ghlEventId: true",
    "locationId: true",
    "message: true",
    "refId: true",
    "email: true",
    "businessPhone: true",
    "normalizedPhone: true",
    "leadId: true",
    "agentId: true",
    "legalName: true",
    "personalEmail: true",
    ".$executeRaw",
    ".$queryRawUnsafe",
    ".$transaction",
    ".create(",
    ".createMany(",
    ".update(",
    ".updateMany(",
    ".delete(",
    ".deleteMany(",
    ".upsert(",
    "revalidatePath",
    '"use server"',
  ]) {
    assert(!content.includes(forbidden), `${path} contains forbidden sensitive selection or mutation behavior: ${forbidden}`);
  }

  for (const category of ["appointments", "documents", "funding", "invoices", "opportunities", "replies", "other"]) {
    assert(content.includes(`"${category}"`), `${path} is missing webhook category ${category}.`);
  }
}

function checkPageAndApi() {
  const pagePath = "src/app/admin/integrations/health/page.tsx";
  const page = read(pagePath);
  for (const expected of [
    'export const dynamic = "force-dynamic"',
    "requireRole(ADMIN_ROLES)",
    "getIntegrationHealthSnapshot()",
    'data-integration-health="aggregate-control-plane"',
    'data-integration-health-privacy="aggregate-only"',
    'href="/api/admin/integrations/health"',
    'href="/admin/integrations"',
    "No payload, event, location, message, reference, or contact details are selected or displayed.",
    "snapshot.privacy.includesPayloads",
    "snapshot.privacy.includesContactData",
    "actor.role",
  ]) {
    assert(page.includes(expected), `${pagePath} is missing protected aggregate UI behavior: ${expected}`);
  }
  for (const forbidden of ["actor.email", "event.ghlEventId", "event.locationId", "error.message", "error.refId", "payload"] as const) {
    if (forbidden === "payload") continue;
    assert(!page.includes(forbidden), `${pagePath} exposes forbidden identifying detail: ${forbidden}`);
  }

  const apiPath = "src/app/api/admin/integrations/health/route.ts";
  const api = read(apiPath);
  for (const expected of [
    'export const dynamic = "force-dynamic"',
    "requireRole(ADMIN_ROLES)",
    "getIntegrationHealthSnapshot()",
    "authenticatedRequestId(request)",
    "authenticatedJson",
    "snapshot.ok ? 200 : 503",
    "viewedBy: { role: actor.role }",
  ]) {
    assert(api.includes(expected), `${apiPath} is missing protected API behavior: ${expected}`);
  }
  for (const forbidden of ["actor.id", "actor.email", "NextResponse.json", "request.json()", '"use server"']) {
    assert(!api.includes(forbidden), `${apiPath} contains forbidden identity or request behavior: ${forbidden}`);
  }
}

function checkNavigationAndRepositoryContract() {
  assertContains("src/app/admin/integrations/page.tsx", 'href="/admin/integrations/health"');
  assertContains("src/app/admin/integrations/page.tsx", "Aggregate health");

  for (const [path, expected] of [
    ["docs/INTEGRATION_HEALTH_CONTROL_PLANE.md", "Read-only aggregate contract"],
    ["docs/INTEGRATION_HEALTH_CONTROL_PLANE.md", "never selects or returns"],
    ["docs/INTEGRATION_HEALTH_CONTROL_PLANE.md", "does not query production"],
    ["docs/INDEX.md", "INTEGRATION_HEALTH_CONTROL_PLANE.md"],
    ["package.json", '"check:integration-health-control-plane": "tsx scripts/check-integration-health-control-plane.ts"'],
    ["package.json", "check-integration-health-control-plane.ts"],
    ["src/lib/lead-deployment-verification.ts", "Integration health control plane guard passed."],
    ["scripts/check-deployment-verification-guard.ts", "Integration health control plane guard passed."],
  ] as const) {
    assertContains(path, expected);
  }
}

function main() {
  checkSnapshot();
  checkPageAndApi();
  checkNavigationAndRepositoryContract();
  console.log("Integration health control plane guard passed.");
}

main();
