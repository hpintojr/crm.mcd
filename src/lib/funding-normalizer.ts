import "server-only";

export type FundingEventKind = "FUNDED" | "FUNDING_FAILED" | "REFUND" | "DISPUTE";

export type FundingEventInput = {
  kind: FundingEventKind;
  collectedCents: number;
  wholesaleCents: number;
  processingFeeCents: number;
  taxCents: number;
  packageCode: string;
  reference: string;
};

function cents(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative whole-cent amount.`);
  return value;
}

export function normalizeFundingEvent(input: FundingEventInput) {
  const reference = input.reference.trim();
  const packageCode = input.packageCode.trim();
  if (!reference || !packageCode) throw new Error("Funding reference and package code are required.");
  return {
    kind: input.kind,
    reference,
    packageCode,
    collectedCents: cents(input.collectedCents, "Collected amount"),
    wholesaleCents: cents(input.wholesaleCents, "Wholesale amount"),
    processingFeeCents: cents(input.processingFeeCents, "Processing fee"),
    taxCents: cents(input.taxCents, "Tax amount"),
  };
}
