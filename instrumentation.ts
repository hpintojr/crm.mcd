import * as Sentry from "@sentry/nextjs";

/**
 * Server-only structured error tracking. Initialization is gated on
 * SENTRY_DSN being present in the server environment; without it the
 * application runs exactly as before. No client-side instrumentation,
 * no tracing, no default PII.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT || "production",
      tracesSampleRate: 0,
      sendDefaultPii: false,
      maxValueLength: 1024,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
