import "server-only";

export type ReconciliationInput = {
  expectedCents: number;
  collectedCents: number;
  refundedCents: number;
  disputedCents: number;
};

export type ReconciliationResult = {
  netCollectedCents: number;
  varianceCents: number;
  status: "MATCHED" | "SHORTFALL" | "OVERAGE" | "DISPUTED";
};

function cents(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative whole-cent amount.`);
  return value;
}

export function reconcileCollection(input: ReconciliationInput): ReconciliationResult {
  const expected = cents(input.expectedCents, "Expected amount");
  const collected = cents(input.collectedCents, "Collected amount");
  const refunded = cents(input.refundedCents, "Refunded amount");
  const disputed = cents(input.disputedCents, "Disputed amount");
  const netCollectedCents = Math.max(0, collected - refunded);
  const varianceCents = netCollectedCents - expected;
  if (disputed > 0) return { netCollectedCents, varianceCents, status: "DISPUTED" };
  if (varianceCents === 0) return { netCollectedCents, varianceCents, status: "MATCHED" };
  return { netCollectedCents, varianceCents, status: varianceCents < 0 ? "SHORTFALL" : "OVERAGE" };
}
