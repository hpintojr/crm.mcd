import "server-only";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { verifyLeadImportTransportRequest } from "@/lib/lead-import-request-verifier";
import {
  LeadImportConfigurationError,
  requireLeadImportHmacConfig,
} from "@/lib/lead-import-env";
import { leadImportHeaderNames } from "@/lib/lead-import-http";

const MAX_LEAD_IMPORT_BODY_BYTES = 1_000_000;
const MAX_LEAD_IMPORT_REQUEST_ID_LENGTH = 128;
const LEAD_IMPORT_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

export type LeadImportGuardResult =
  | { ok: true; body: unknown; requestId: string }
  | { ok: false; response: NextResponse };

export function leadImportRequestId(request: Request) {
  const supplied = request.headers.get(leadImportHeaderNames.requestId)?.trim();
  return supplied &&
    supplied.length <= MAX_LEAD_IMPORT_REQUEST_ID_LENGTH &&
    LEAD_IMPORT_REQUEST_ID_PATTERN.test(supplied)
    ? supplied
    : randomUUID();
}

export function leadImportJson(body: unknown, status: number, requestId: string) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Request-Id": requestId,
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

function payloadTooLargeResponse(requestId: string) {
  return leadImportJson(
    { error: "LEAD_IMPORT_PAYLOAD_TOO_LARGE", message: "Lead-import payload exceeds the allowed size." },
    413,
    requestId,
  );
}

function declaredContentLength(headers: Headers) {
  const value = headers.get("content-length");
  if (!value) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Shared entry guard for every /api/lead-imports/* route: validates the
 * HMAC signature (see lead-import-auth.ts) and confirms the caller's keyId
 * matches the single provisioned lead-import client before any handler
 * touches the database.
 */
export async function guardLeadImportRequest(request: Request, path: string): Promise<LeadImportGuardResult> {
  const requestId = leadImportRequestId(request);
  const declaredLength = declaredContentLength(request.headers);
  if (declaredLength !== null && declaredLength > MAX_LEAD_IMPORT_BODY_BYTES) {
    return { ok: false, response: payloadTooLargeResponse(requestId) };
  }

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
        response: leadImportJson(
          { error: "LEAD_IMPORT_UNAVAILABLE", message: "Lead-import service is not configured." },
          503,
          requestId,
        ),
      };
    }
    throw error;
  }

  let bodyText: string;
  try {
    bodyText = await request.text();
  } catch {
    return {
      ok: false,
      response: leadImportJson(
        { error: "LEAD_IMPORT_BODY_READ_ERROR", message: "Unable to read lead-import request body." },
        400,
        requestId,
      ),
    };
  }

  if (new TextEncoder().encode(bodyText).byteLength > MAX_LEAD_IMPORT_BODY_BYTES) {
    return { ok: false, response: payloadTooLargeResponse(requestId) };
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
      response: leadImportJson(
        { error: verification.response.code, message: verification.response.message },
        verification.response.status,
        requestId,
      ),
    };
  }

  if (verification.auth.keyId !== expectedKeyId) {
    return {
      ok: false,
      response: leadImportJson(
        { error: "LEAD_IMPORT_UNAUTHORIZED", message: "Unknown lead-import key id." },
        401,
        requestId,
      ),
    };
  }

  if (bodyText.trim().length === 0) return { ok: true, body: {}, requestId };

  try {
    return { ok: true, body: JSON.parse(bodyText), requestId };
  } catch {
    return {
      ok: false,
      response: leadImportJson(
        { error: "LEAD_IMPORT_INVALID_JSON", message: "Request body must be valid JSON." },
        400,
        requestId,
      ),
    };
  }
}
