import { readFileSync } from "node:fs";

function assertContains(path: string, expected: string) {
  const content = readFileSync(path, "utf8");
  if (!content.includes(expected)) {
    throw new Error(`${path} is missing required controlled warm reply guard: ${expected}`);
  }
}

const guards: [string, string][] = [
  ["src/lib/controlled-warm-replies.ts", "CONTROLLED_WARM_REPLY_SOURCE"],
  ["src/lib/controlled-warm-replies.ts", "isControlledTestLead"],
  ["src/lib/controlled-warm-replies.ts", "Only controlled test Leads can receive a simulated inbound reply."],
  ["src/app/admin/leads/controlled-test-data/page.tsx", "simulateWarmReply"],
  ["src/app/admin/leads/controlled-test-data/page.tsx", "Simulate inbound reply (warm-reply triage test)"],
  ["src/app/admin/leads/controlled-test-data/page.tsx", "simulateControlledWarmReply"],
  ["src/lib/lead-deployment-verification.ts", "Controlled warm reply guard passed."],
];

for (const [path, expected] of guards) {
  assertContains(path, expected);
}

console.log("Controlled warm reply guard passed.");
