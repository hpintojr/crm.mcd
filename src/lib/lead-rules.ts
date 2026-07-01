import "server-only";

export function protectionWindow(input: { referral: boolean; source?: string | null; twoWayAt?: Date | null; booked: boolean }) {
  if (input.referral) {
    if (!input.source?.trim()) throw new Error("Referral source required.");
    return { protected: true, releaseAt: null, reason: "Documented referral" };
  }
  if (!input.twoWayAt) return { protected: false, releaseAt: null, reason: "Two-way contact required" };
  if (input.booked) return { protected: true, releaseAt: null, reason: "Demo booked" };
  const releaseAt = new Date(input.twoWayAt);
  releaseAt.setUTCDate(releaseAt.getUTCDate() + 45);
  return { protected: true, releaseAt, reason: "45-day OpenPool window" };
}

export function sharkTankEligible(input: { booked: boolean; pitched: boolean; stalled: boolean }) {
  return input.pitched && input.stalled && !input.booked;
}
