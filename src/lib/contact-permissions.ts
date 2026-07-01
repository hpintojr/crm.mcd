import "server-only";

export type ContactChannel = "CALL" | "SMS" | "SALES_EMAIL" | "MARKETING_EMAIL" | "SOCIAL_DM" | "TRANSACTIONAL" | "BILLING" | "SECURITY" | "OUTAGE";

export function contactPermitted(input: { dnc: boolean; suppressed: boolean; channel: ContactChannel }) {
  const exempt = ["TRANSACTIONAL", "BILLING", "SECURITY", "OUTAGE"].includes(input.channel);
  if ((input.dnc || input.suppressed) && !exempt) return false;
  return true;
}

export function requireContactPermission(input: { dnc: boolean; suppressed: boolean; channel: ContactChannel }) {
  if (!contactPermitted(input)) throw new Error("DNC and suppression prohibit this contact channel.");
}
