import { readFileSync } from "node:fs";

function assertContains(path: string, expected: string) {
  const content = readFileSync(path, "utf8");
  if (!content.includes(expected)) {
    throw new Error(`${path} is missing required owner-decision prep guard: ${expected}`);
  }
}

const guards: [string, string][] = [
  ["src/app/admin/leads/owner-decision-prep/page.tsx", "data-owner-decision-prep=\"lead-flow\""],
  ["src/app/admin/leads/owner-decision-prep/page.tsx", "Owner decision prep"],
  ["src/app/admin/leads/owner-decision-prep/page.tsx", "Read-only Hamilton owner-decision prep"],
  ["src/app/admin/leads/owner-decision-prep/page.tsx", "Do not record the owner production decision yet"],
  ["src/app/admin/leads/owner-decision-prep/page.tsx", "getLeadAcceptanceHandoffPacket"],
  ["src/app/admin/leads/owner-decision-prep/page.tsx", "getLeadAcceptanceDeferredRunbook"],
  ["src/app/admin/leads/owner-decision-prep/page.tsx", "getLeadAcceptanceClosedGates"],
  ["src/app/admin/leads/owner-decision-prep/page.tsx", "/admin/leads/deep-links#owner-decision-prep"],
  ["src/app/admin/leads/owner-decision-prep/page.tsx", "Deep link anchor"],
  ["src/app/admin/leads/acceptance-overview/page.tsx", "/admin/leads/owner-decision-prep"],
  ["src/app/admin/leads/acceptance-overview/page.tsx", "Owner decision prep"],
  ["src/app/admin/leads/acceptance-overview/page.tsx", "Open owner prep"],
  ["src/lib/lead-acceptance-overview.ts", "owner-decision-prep"],
  ["src/lib/lead-acceptance-overview.ts", "/admin/leads/owner-decision-prep"],
];

for (const [path, expected] of guards) {
  assertContains(path, expected);
}

console.log("Owner decision prep guard passed.");
