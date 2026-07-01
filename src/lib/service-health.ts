import "server-only";

export type ServiceHealthInput = {
  paymentCurrent: boolean;
  openSupportIssues: number;
  renewalDueWithinDays?: number | null;
  unresolvedEscalations: number;
  recentClientRequests: number;
};

export type ServiceHealth = { status: "HEALTHY" | "ATTENTION" | "AT_RISK"; requiresAction: boolean; reasons: string[] };

export function assessServiceHealth(input: ServiceHealthInput): ServiceHealth {
  const reasons: string[] = [];
  if (!input.paymentCurrent) reasons.push("Payment issue");
  if (input.openSupportIssues > 0) reasons.push("Open support issue");
  if (input.unresolvedEscalations > 0) reasons.push("Unresolved escalation");
  if (input.renewalDueWithinDays !== null && input.renewalDueWithinDays !== undefined && input.renewalDueWithinDays <= 30) reasons.push("Renewal event");
  if (input.recentClientRequests > 0) reasons.push("Client request");
  if (!input.paymentCurrent || input.unresolvedEscalations > 0) return { status: "AT_RISK", requiresAction: true, reasons };
  if (reasons.length > 0) return { status: "ATTENTION", requiresAction: true, reasons };
  return { status: "HEALTHY", requiresAction: false, reasons: ["Current payment and no triggered service event"] };
}
