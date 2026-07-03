import type { LeadIntakeMethodValue } from "@/lib/lead-taxonomy";

/**
 * Intake policy shared by legacy Admin import and the future signed importer.
 * The local lead tool must never use a prohibited intake method as a shortcut
 * around approved acquisition and review controls.
 */

const blockedIntakeMethods = new Set<LeadIntakeMethodValue>(["SCRAPE_IMPORT"]);

export function getLeadImportIntakePolicyViolation(intakeMethod: LeadIntakeMethodValue) {
  if (!blockedIntakeMethods.has(intakeMethod)) return null;

  return "This intake method is not permitted. Use an approved source and the controlled lead-review workflow.";
}

export function assertLeadImportIntakeAllowed(intakeMethod: LeadIntakeMethodValue) {
  const violation = getLeadImportIntakePolicyViolation(intakeMethod);
  if (violation) throw new Error(violation);
}
