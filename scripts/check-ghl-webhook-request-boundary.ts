import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertContains(path: string, expected: string) {
  const content = readFileSync(path, "utf8");
  assert(content.includes(expected), `${path} is missing required GHL request boundary: ${expected}`);
}

function assertExcludes(path: string, forbidden: string) {
  const content = readFileSync(path, "utf8");
  assert(!content.includes(forbidden), `${path} contains forbidden GHL request behavior: ${forbidden}`);
}

function checkSharedBoundary() {
  const path = "src/lib/ghl-webhook.ts";
  const content = readFileSync(path, "utf8");

  for (const expected of [
    "MAX_GHL_WEBHOOK_BODY_BYTES = 1_048_576",
    "verifyGhlWebhookSecret(request)",
    "const declaredLength = Number(request.headers.get(\"content-length\")",
    "rawText = await request.text()",
    "new TextEncoder().encode(rawText).byteLength",
    "JSON.parse(rawText)",
    '"Cache-Control": "no-store, max-age=0"',
    '"X-Request-Id": requestId',
    '"X-Robots-Tag": "noindex, nofollow, noarchive"',
    "verifyGhlWebhookLocation",
    "sanitizedGhlWebhookFailure",
    "logGhlWebhookRuntimeFailure",
    "databaseErrorName(error)",
    "databaseErrorCode(error)",
  ]) {
    assertContains(path, expected);
  }

  const secretIndex = content.indexOf("const secret = verifyGhlWebhookSecret(request)", content.indexOf("prepareGhlWebhookRequest"));
  const textIndex = content.indexOf("rawText = await request.text()", content.indexOf("prepareGhlWebhookRequest"));
  const parseIndex = content.indexOf("JSON.parse(rawText)", content.indexOf("prepareGhlWebhookRequest"));
  assert(secretIndex >= 0 && textIndex > secretIndex && parseIndex > textIndex, "Secret verification must occur before body reading and JSON parsing.");
  assert((content.match(/NextResponse\.json/g) ?? []).length === 1, "All GHL boundary responses must use the centralized JSON helper.");
}

function checkRoutes() {
  const routes = [
    "src/app/api/ghl/appointments/route.ts",
    "src/app/api/ghl/documents/route.ts",
    "src/app/api/ghl/funding/route.ts",
    "src/app/api/ghl/invoices/route.ts",
    "src/app/api/ghl/opportunities/route.ts",
    "src/app/api/ghl/replies/route.ts",
  ];

  for (const path of routes) {
    const content = readFileSync(path, "utf8");
    for (const expected of [
      "prepareGhlWebhookRequest",
      "if (!prepared.ok) return prepared.response",
      "verifyGhlWebhookLocation",
      "ghlWebhookJson",
      "requestId",
    ]) {
      assert(content.includes(expected), `${path} is missing shared request-boundary usage: ${expected}`);
    }

    const prepareIndex = content.indexOf("const prepared = await prepareGhlWebhookRequest(request)");
    const schemaIndex = content.indexOf(".safeParse(raw)");
    const locationIndex = content.indexOf("verifyGhlWebhookLocation");
    assert(prepareIndex >= 0 && schemaIndex > prepareIndex && locationIndex > schemaIndex, `${path} must prepare the request, validate its schema, then verify location.`);

    for (const forbidden of [
      "request.json()",
      "NextResponse.json",
      "verifyGhlWebhook(request",
      "error instanceof Error ? error.message",
      "error.message",
      "payload: raw as Prisma.InputJsonValue,\n    });\n    return ghlWebhookJson({ error:",
    ]) {
      assert(!content.includes(forbidden), `${path} contains forbidden route-level request or error behavior: ${forbidden}`);
    }
  }

  for (const path of [
    "src/app/api/ghl/appointments/route.ts",
    "src/app/api/ghl/documents/route.ts",
    "src/app/api/ghl/funding/route.ts",
    "src/app/api/ghl/invoices/route.ts",
    "src/app/api/ghl/opportunities/route.ts",
    "src/app/api/ghl/replies/route.ts",
  ]) {
    assertContains(path, "sanitizedGhlWebhookFailure");
    assertContains(path, "logGhlWebhookRuntimeFailure");
  }
}

function checkRepositoryContract() {
  for (const [path, expected] of [
    ["docs/GHL_WEBHOOK_REQUEST_BOUNDARY.md", "Authenticate before reading the body"],
    ["docs/GHL_WEBHOOK_REQUEST_BOUNDARY.md", "1 MiB"],
    ["docs/GHL_WEBHOOK_REQUEST_BOUNDARY.md", "does not send a webhook"],
    ["docs/INDEX.md", "GHL_WEBHOOK_REQUEST_BOUNDARY.md"],
    ["package.json", '"check:ghl-webhook-request-boundary": "tsx scripts/check-ghl-webhook-request-boundary.ts"'],
    ["package.json", "check-ghl-webhook-request-boundary.ts"],
    ["src/lib/lead-deployment-verification.ts", "GHL webhook request boundary guard passed."],
    ["scripts/check-deployment-verification-guard.ts", "GHL webhook request boundary guard passed."],
  ] as const) {
    assertContains(path, expected);
  }
}

function main() {
  checkSharedBoundary();
  checkRoutes();
  checkRepositoryContract();
  console.log("GHL webhook request boundary guard passed.");
}

main();
