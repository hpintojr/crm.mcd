import { readFileSync } from "node:fs";

const path = "src/app/admin/agents/[id]/certify/page.tsx";
const content = readFileSync(path, "utf8");

function assertContains(expected: string) {
  if (!content.includes(expected)) {
    throw new Error(`${path} is missing required certification precondition contract: ${expected}`);
  }
}

function assertExcludes(forbidden: string) {
  if (content.includes(forbidden)) {
    throw new Error(`${path} must not throw expected certification precondition failures: ${forbidden}`);
  }
}

for (const expected of [
  'import { notFound, redirect } from "next/navigation"',
  'searchParams: Promise<{ error?: string; saved?: string }>',
  'const approvalReady = agent.status === "ACTIVE" && allDocumentsComplete',
  'const defaultDecision = approvalReady ? latest?.decision || "NOT_YET_APPROVED" : "NOT_YET_APPROVED"',
  'redirect(`/admin/agents/${current.id}/certify?error=inactive`)',
  'redirect(`/admin/agents/${current.id}/certify?error=documents`)',
  'redirect(`/admin/agents/${current.id}/certify?saved=1`)',
  'disabled={!approvalReady}',
  'Approval prerequisites not met',
  'No certification decision was recorded.',
  'Certification decision recorded successfully.',
  'actionType: "AGENT_CERTIFICATION_RECORDED"',
  'canClaimLeads: approving',
]) {
  assertContains(expected);
}

for (const forbidden of [
  'throw new Error("Only an active agent can receive Lead eligibility.")',
  'throw new Error("Complete all onboarding documents before approving Lead eligibility.")',
]) {
  assertExcludes(forbidden);
}

console.log("Certification precondition UX guard passed.");
