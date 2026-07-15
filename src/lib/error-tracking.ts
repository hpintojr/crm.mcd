import "server-only";

import * as Sentry from "@sentry/nextjs";
import { sentryConfigured } from "@/lib/env";

/**
 * Forwards a structured integration failure to the error tracker.
 * Source, message, and reference id only; webhook bodies, stored JSON,
 * and PII never leave the MiniCRM database.
 */
export function captureIntegrationError(source: string, message: string, refId?: string | null) {
  if (!sentryConfigured) return;
  try {
    Sentry.captureMessage(message, {
      level: "error",
      tags: { source },
      extra: refId ? { refId } : undefined,
    });
  } catch {
    // Error tracking must never break the request path.
  }
}
