import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

function secretsMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

/**
 * Temporary protection for internal admin routes until authenticated users and RBAC are live.
 * The route fails closed when MCD_ADMIN_API_KEY has not been configured.
 */
export function requireAdminApiKey(req: NextRequest): NextResponse | null {
  const expected = env.admin.apiKey;
  if (!expected) {
    return NextResponse.json(
      { error: "Admin access is not configured." },
      { status: 503 },
    );
  }

  const authorization = req.headers.get("authorization") ?? "";
  const bearer = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  const provided = bearer || req.headers.get("x-mcd-admin-key")?.trim() || "";

  if (!provided || !secretsMatch(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

/** Verifies the shared secret required on every inbound GHL webhook. */
export function hasValidGhlWebhookSecret(req: NextRequest): boolean {
  const expected = env.ghl.webhookSecret;
  const provided = req.headers.get("x-mcd-webhook-secret")?.trim() || "";

  return Boolean(expected && provided && secretsMatch(provided, expected));
}
