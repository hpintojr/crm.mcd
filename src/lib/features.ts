import "server-only";

function enabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

export const features = {
  leads: enabled(process.env.LEADS_ENABLED),
  commissions: enabled(process.env.COMMISSIONS_ENABLED),
  servicing: enabled(process.env.SERVICING_ENABLED),
  finance: enabled(process.env.FINANCE_ENABLED),
};

export function requireFeature(feature: keyof typeof features) {
  if (!features[feature]) throw new Error(`${feature} is not enabled.`);
}
