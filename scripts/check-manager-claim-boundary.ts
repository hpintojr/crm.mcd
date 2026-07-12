import { readFileSync } from "node:fs";

function assertContains(path: string, expected: string) {
  const content = readFileSync(path, "utf8");
  if (!content.includes(expected)) {
    throw new Error(`${path} is missing manager claim-boundary contract: ${expected}`);
  }
}

const page = "src/app/portal/leads/page.tsx";
const service = "src/lib/claims.ts";

const pageContracts = [
  'import { redirect } from "next/navigation";',
  'import { isControlledTestLead } from "@/lib/controlled-test-leads";',
  "const { agent, isAdmin } = await getPortalContext();",
  "const selectedColdIsControlledTest = selectedColdLead ? isControlledTestLead(selectedColdLead) : false;",
  "const selectedColdClaimActorReady = Boolean(agent?.canClaimLeads) && (!isAdmin || selectedColdIsControlledTest);",
  "const selectedColdClaimReady = selectedColdClaimEligible && selectedColdClaimActorReady;",
  "Managers must use Admin reassignment controls for real Leads.",
  "{selectedColdClaimReady && <form action={claim}",
  'data-agent-action="claim-guidance"',
  'message === "Use reassignment controls for manager lead assignment."',
  'message === "Lead access is pending manager certification."',
  'message.startsWith("Active lead capacity of ")',
  "if (!status) throw error;",
  "claimStatus=${status}#cold-lead-review",
  "claimStatus=claimed",
  'data-claim-feedback={params.claimStatus}',
];

const serviceContracts = [
  "if (ADMIN.includes(actor.role))",
  "if (!isControlledTestLead(targetLead))",
  'throw new Error("Use reassignment controls for manager lead assignment.")',
  'if (!agent?.canClaimLeads) throw new Error("Lead access is pending manager certification.")',
  'twoWayContactAt: { not: null }',
  "const updated = await db.lead.updateMany",
  'if (updated.count !== 1) throw new Error("This record is no longer available to claim.")',
  'action: "CLAIMED"',
  'rule: "TWO_WAY_CONTACT_REQUIRED"',
];

for (const expected of pageContracts) assertContains(page, expected);
for (const expected of serviceContracts) assertContains(service, expected);

const pageSource = readFileSync(page, "utf8");
if (pageSource.includes("{selectedColdClaimEligible && <form action={claim}")) {
  throw new Error("The claim form must not render from Lead eligibility alone; actor eligibility is required.");
}

console.log("Manager claim action boundary guard passed.");
