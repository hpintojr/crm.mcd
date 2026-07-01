import "server-only";

export type ContactRestriction = {
  dnc: boolean;
  suppressed: boolean;
  lifecycle?: string;
};

export function outboundPermitted(record: ContactRestriction) {
  return !record.dnc && !record.suppressed && record.lifecycle !== "SUPPRESSED";
}

export function requireOutboundPermission(record: ContactRestriction) {
  if (!outboundPermitted(record)) throw new Error("Outbound activity is blocked for this suppressed record.");
}

export function retentionCutoff(now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 7);
  return cutoff;
}
