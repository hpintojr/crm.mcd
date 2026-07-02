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

export function allowedGhlLocations(): Set<string> {
  return new Set([env.ghl.salesHqLocationId, ...env.ghl.allowedLocationIds].filter(Boolean));
}
