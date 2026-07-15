export type ServiceCadence = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

export const CADENCE_PERIOD_DAYS: Record<ServiceCadence, number> = {
  WEEKLY: 7,
  BIWEEKLY: 14,
  MONTHLY: 30,
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function nextCadenceDue(lastTouch: Date, cadence: ServiceCadence): Date {
  return new Date(lastTouch.getTime() + CADENCE_PERIOD_DAYS[cadence] * DAY_MS);
}

export type CadenceAssessmentInput = {
  now: Date;
  /** Most recent cadence anchor: activation, last health confirmation, or last cadence case opening — whichever is latest. */
  lastTouch: Date;
  cadence: ServiceCadence;
};

export type CadenceAssessment = {
  due: Date;
  isDue: boolean;
};

export function assessCadence(input: CadenceAssessmentInput): CadenceAssessment {
  const due = nextCadenceDue(input.lastTouch, input.cadence);
  return { due, isDue: due.getTime() <= input.now.getTime() };
}

export function latestOf(first: Date, ...rest: Array<Date | null | undefined>): Date {
  let latest = first;
  for (const candidate of rest) {
    if (candidate && candidate.getTime() > latest.getTime()) latest = candidate;
  }
  return latest;
}
