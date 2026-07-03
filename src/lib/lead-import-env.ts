import "server-only";

export type LeadImportHmacConfig = {
  keyId: string;
  secret: string;
};

/**
 * Reads the shared HMAC credential used to authenticate signed lead-import
 * batch requests (mcd_lead_ops -> POST /api/lead-imports and friends).
 *
 * LEAD_IMPORT_KEY_ID and LEAD_IMPORT_HMAC_SECRET must be provisioned in
 * Vercel (and mirrored into mcd_lead_ops's local config) before any lead
 * import route will accept traffic. Provisioning that secret is a separate,
 * explicit step -- this module only reads it, it never generates or stores one.
 */
export function requireLeadImportHmacConfig(): LeadImportHmacConfig {
  const keyId = process.env.LEAD_IMPORT_KEY_ID;
  const secret = process.env.LEAD_IMPORT_HMAC_SECRET;

  if (!keyId || !secret) {
    throw new Error(
      "Lead import API is not configured: LEAD_IMPORT_KEY_ID and LEAD_IMPORT_HMAC_SECRET must both be set."
    );
  }

  return { keyId, secret };
}
