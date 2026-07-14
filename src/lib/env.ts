// Central, server-only environment access. Import ONLY in server code (route handlers,
// server components, server actions). Never import into a "use client" file.

function get(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

function csv(name: string): string[] {
  return get(name)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export const env = {
  appUrl: get("APP_URL", "http://localhost:3000"),
  appName: get("APP_NAME", "Mercury Call Desk"),

  auth: {
    secret: get("AUTH_SECRET"),
    url: get("AUTH_URL", "http://localhost:3000"),
    trustHost: get("AUTH_TRUST_HOST", "true") === "true",
  },

  databaseUrl: get("DATABASE_URL"),

  ghl: {
    token: get("GHL_PRIVATE_TOKEN"),
    apiBase: get("GHL_API_BASE", "https://services.leadconnectorhq.com"),
    apiVersion: get("GHL_API_VERSION", "2021-07-28"),
    salesHqLocationId: get("GHL_SALES_HQ_LOCATION_ID"),
    webhookSecret: get("GHL_WEBHOOK_SECRET"),
    allowedLocationIds: csv("GHL_ALLOWED_LOCATION_IDS"),
    miniCrmLeadIdFieldId: get("GHL_MINI_CRM_LEAD_ID_FIELD_ID"),
    // Onboarding packet coordinator (Option B) template ids. Unused unless
    // ONBOARDING_PACKET_COORDINATOR_ENABLED is true. See docs/ONBOARDING_PACKET_COORDINATOR.md.
    templateIds: {
      salesAgreement: get("GHL_TEMPLATE_ID_SALES_AGREEMENT"),
      ndaIp: get("GHL_TEMPLATE_ID_NDA_IP"),
      w9Payout: get("GHL_TEMPLATE_ID_W9_PAYOUT"),
      acknowledgment: get("GHL_TEMPLATE_ID_ACKNOWLEDGMENT"),
    },
    // Onboarding packet coordinator (Option B) only. The real Send Template API requires a
    // userId in the request body (confirmed live 2026-07-14 — omitting it returns 422).
    // This is the GHL user id documents are sent "as" (e.g. QFI1UtOuwrYNKUfBYdIy for
    // Hamilton Pinto in the MCD account) — set explicitly per environment, not hardcoded.
    sendingUserId: get("GHL_SENDING_USER_ID"),
  },

  emailAccessToken: get("EMAIL_ACCESS_TOKEN"),
  payoutProvider: get("PAYOUT_PROVIDER", "stripe"),

  smtp: {
    host: get("EMAIL_SMTP_HOST", "smtp.ionos.com"),
    port: Number(get("EMAIL_SMTP_PORT", "587")) || 587,
    user: get("EMAIL_SMTP_USER"),
    password: get("EMAIL_SMTP_PASSWORD"),
    fromAddress: get("EMAIL_FROM_ADDRESS", "no-reply@mercurycalldesk.com"),
    fromName: get("EMAIL_FROM_NAME", "Mercury Call Desk"),
  },
};

export const ghlConfigured = Boolean(env.ghl.token && env.ghl.salesHqLocationId);
export const ghlMiniCrmLeadIdFieldConfigured = Boolean(env.ghl.miniCrmLeadIdFieldId);
export const smtpConfigured = Boolean(env.smtp.user && env.smtp.password);

// Option B onboarding packet coordinator. Default OFF. Do not set true in production
// until the gates in docs/ONBOARDING_PACKET_COORDINATOR.md are satisfied.
export const onboardingPacketCoordinatorEnabled = get("ONBOARDING_PACKET_COORDINATOR_ENABLED", "false") === "true";

export function allowedGhlLocations(): Set<string> {
  return new Set([env.ghl.salesHqLocationId, ...env.ghl.allowedLocationIds].filter(Boolean));
}
