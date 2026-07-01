// Central, server-only environment access. Import ONLY in server code (route handlers,
// server components, server actions). Never import into a "use client" file.

function get(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  appUrl: get("APP_URL", "http://localhost:3000"),
  appName: get("APP_NAME", "Mercury Call Desk"),

  databaseUrl: get("DATABASE_URL"),

  ghl: {
    token: get("GHL_PRIVATE_TOKEN"),
    apiBase: get("GHL_API_BASE", "https://services.leadconnectorhq.com"),
    apiVersion: get("GHL_API_VERSION", "2021-07-28"),
    salesHqLocationId: get("GHL_SALES_HQ_LOCATION_ID"),
    webhookSecret: get("GHL_WEBHOOK_SECRET"),
  },

  // Server-only email access token (IONOS). Agents never log in directly.
  emailAccessToken: get("EMAIL_ACCESS_TOKEN"),

  payoutProvider: get("PAYOUT_PROVIDER", "stripe"),
};

/** True when the GHL backend is configured; lets the app run in a safe "stub" mode until then. */
export const ghlConfigured = Boolean(env.ghl.token && env.ghl.salesHqLocationId);
