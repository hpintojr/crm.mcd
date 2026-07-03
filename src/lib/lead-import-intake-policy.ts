export type LeadImportIntakePolicyInput = { originalSource: string; intakeMethod: string };

const blockedIntakeMethods = new Set(["SCRAPE_IMPORT"]);

export function getLeadImportIntakePolicyViolation(input: LeadImportIntakePolicyInput): string | null {
  if (blockedIntakeMethods.has(input.intakeMethod)) {
    return "This acquisition mode is not permitted for MiniCRM import. Use an approved intake method with documented permitted use.";
  }
  return null;
}

export function assertLeadImportIntakeAllowed(input: LeadImportIntakePolicyInput) {
  const violation = getLeadImportIntakePolicyViolation(input);
  if (violation) throw new Error(violation);
}
