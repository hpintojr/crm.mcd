export type CommissionCalculationInput = {
  collectedCents: number;
  wholesaleCents: number;
  processingFeeCents: number;
  taxCents: number;
  minProfitCents?: number;
};

export type CommissionCalculation = {
  collectedExcludingTaxCents: number;
  netCommissionableProfitCents: number;
  agentShareCents: number;
  companyShareCents: number;
  meetsMinimumProfit: boolean;
};

function wholeCents(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative whole-cent amount.`);
  return value;
}

export function calculateFiftyFiftyCommission(input: CommissionCalculationInput): CommissionCalculation {
  const collected = wholeCents(input.collectedCents, "Collected amount");
  const tax = wholeCents(input.taxCents, "Tax amount");
  const wholesale = wholeCents(input.wholesaleCents, "Wholesale amount");
  const processing = wholeCents(input.processingFeeCents, "Processing fee");
  const minimum = wholeCents(input.minProfitCents ?? 0, "Minimum profit");
  const collectedExcludingTaxCents = Math.max(0, collected - tax);
  const netCommissionableProfitCents = Math.max(0, collectedExcludingTaxCents - wholesale - processing);
  const meetsMinimumProfit = netCommissionableProfitCents >= minimum;
  const agentShareCents = meetsMinimumProfit ? Math.floor(netCommissionableProfitCents / 2) : 0;
  const companyShareCents = netCommissionableProfitCents - agentShareCents;
  return { collectedExcludingTaxCents, netCommissionableProfitCents, agentShareCents, companyShareCents, meetsMinimumProfit };
}
