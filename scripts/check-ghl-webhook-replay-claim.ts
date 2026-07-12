import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertContains(path: string, expected: string) {
  const content = readFileSync(path, "utf8");
  assert(content.includes(expected), `${path} is missing required GHL replay contract: ${expected}`);
}

function assertExcludes(path: string, forbidden: string) {
  const content = readFileSync(path, "utf8");
  assert(!content.includes(forbidden), `${path} contains forbidden non-atomic GHL replay behavior: ${forbidden}`);
}

function checkSharedLedger() {
  const path = "src/lib/ghl-webhook.ts";
  const content = readFileSync(path, "utf8");

  for (const expected of [
    "await db.webhookEvent.create",
    'error.code !== "P2002"',
    "const claimed = await db.webhookEvent.updateMany",
    "ghlEventId: event.ghlEventId",
    'status: "ERROR"',
    'status: "RECEIVED"',
    "processedAt: null",
    "if (claimed.count !== 1)",
    "return { firstTime: false as const, retry: false as const }",
    "return { firstTime: true as const, retry: true as const }",
    "only the winner receives count=1",
  ]) {
    assertContains(path, expected);
  }

  const createIndex = content.indexOf("await db.webhookEvent.create");
  const claimIndex = content.indexOf("const claimed = await db.webhookEvent.updateMany");
  const countIndex = content.indexOf("if (claimed.count !== 1)");
  const retryIndex = content.indexOf("return { firstTime: true as const, retry: true as const }");
  assert(createIndex >= 0 && claimIndex > createIndex && countIndex > claimIndex && retryIndex > countIndex, "Create, conditional retry claim, winner check, and retry result must remain ordered.");
  assert((content.match(/db\.webhookEvent\.updateMany/g) ?? []).length === 1, "Failed-event retries must use exactly one conditional updateMany claim.");

  for (const forbidden of [
    "const existing = await db.webhookEvent.findUnique",
    'existing?.status !== "ERROR"',
    "await db.webhookEvent.update({\n      where: { ghlEventId: event.ghlEventId }",
  ]) {
    assertExcludes(path, forbidden);
  }
}

function checkConsumers() {
  const consumers = [
    "src/app/api/ghl/appointments/route.ts",
    "src/app/api/ghl/documents/route.ts",
    "src/app/api/ghl/funding/route.ts",
    "src/app/api/ghl/invoices/route.ts",
    "src/lib/ghl-inbound-reply-relay.ts",
    "src/lib/ghl-opportunity-relay.ts",
  ];

  for (const path of consumers) {
    assertContains(path, "recordInboundEvent");
  }

  assertContains("src/lib/ghl-inbound-reply-relay.ts", "if (!event.firstTime)");
  assertContains("src/lib/ghl-opportunity-relay.ts", "if (!event.firstTime)");
  assertContains("src/app/api/ghl/appointments/route.ts", "if (!event.firstTime)");
  assertContains("src/app/api/ghl/documents/route.ts", "if (!recorded.firstTime)");
  assertContains("src/app/api/ghl/funding/route.ts", "if (!event.firstTime)");
  assertContains("src/app/api/ghl/invoices/route.ts", "if (!event.firstTime)");
}

function checkRepositoryContract() {
  for (const [path, expected] of [
    ["docs/GHL_WEBHOOK_REPLAY.md", "Atomic failed-event retry claim"],
    ["docs/GHL_WEBHOOK_REPLAY.md", "only one retry delivery"],
    ["docs/INDEX.md", "GHL_WEBHOOK_REPLAY.md"],
    ["package.json", '"check:ghl-webhook-replay-claim": "tsx scripts/check-ghl-webhook-replay-claim.ts"'],
    ["package.json", "check-ghl-webhook-replay-claim.ts"],
    ["src/lib/lead-deployment-verification.ts", "GHL webhook replay claim guard passed."],
    ["scripts/check-deployment-verification-guard.ts", "GHL webhook replay claim guard passed."],
  ] as const) {
    assertContains(path, expected);
  }
}

function main() {
  checkSharedLedger();
  checkConsumers();
  checkRepositoryContract();
  console.log("GHL webhook replay claim guard passed.");
}

main();
