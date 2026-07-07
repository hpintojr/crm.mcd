import "server-only";

import { NextResponse } from "next/server";
import { verifyLeadImportTransportRequest } from "@/lib/lead-import-request-verifier";
import {
  LeadImportConfigurationError,
  requireLeadImportHmacConfig,
} from "@/lib/lead-import-env";

export type LeadImportGuardResult =
  | { ok: true; body: unknown }
  | { ok: false; response: NextResponse };

/**
 * Shared entry guard for every /api/lead-imports/* route: validates the
 * HMAC signature (see lead-import-auth.ts) and confirms the caller's keyId
 * matches the single provisioned lead-import client before any handler
 * touches the database.
 */
export async function guardLeadImportRequest(request: Request, path: string): Promise<LeadImportGuardResult> {
  const bodyText = await request.text();

  let secret: string;
  let expectedKeyId: string;
  try {
    const config = requireLeadImportHmacConfig();
    secret = config.secret;
    expectedKeyId = config.keyId;
  } catch (error) {
    if (error instanceof LeadImportConfigurationError) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "LEAD_IMPORT_UNAVAILABLE", message: "Lead-import service is not configured." },
          { status: 503 }
        ),
      };
    }
    throw error;
  }

  const verification = verifyLeadImportTransportRequest({
    headers: request.headers,
    contentType: request.headers.get("content-type"),
    body: bodyText,
    method: request.method,
    path,
    hmacSecret: secret,
  });

  if (!verification.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: verification.response.code, message: verification.response.message },
        { status: verification.response.status }
      ),
    };
  }

  if (verification.auth.keyId !== expectedKeyId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "LEAD_IMPORT_UNAUTHORIZED", message: "Unknown lead-import key id." },
        { status: 401 }
      ),
    };
  }

  if (bodyText.trim().length === 0) return { ok: true, body: {} };

  try {
    return { ok: true, body: JSON.parse(bodyText) };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "LEAD_IMPORT_INVALID_JSON", message: "Request body must be valid JSON." },
        { status: 400 }
      ),
    };
  }
}
