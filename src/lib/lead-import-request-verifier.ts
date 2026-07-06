import {
  DEFAULT_LEAD_IMPORT_MAX_CLOCK_SKEW_MS,
  verifyLeadImportRequest,
} from "@/lib/lead-import-auth";
import {
  isLeadImportJsonContentType,
  leadImportUnauthorizedResponse,
  leadImportUnsupportedMediaTypeResponse,
  readLeadImportTransportHeaders,
  type LeadImportRequestHeaderInput,
} from "@/lib/lead-import-http";
import type { LeadImportRequestHeaders } from "@/lib/lead-import-contract";

/**
 * Pure verification boundary for the signed paid-data import endpoint family.
 * Read-only status requests may be signed with an empty body and no
 * Content-Type. Requests that carry a body still require application/json.
 */

export type LeadImportRequestVerifierInput = {
  headers: LeadImportRequestHeaderInput;
  contentType: string | null;
  body: string | Uint8Array;
  method: string;
  path: string;
  hmacSecret: string;
  now?: number;
  maxClockSkewMs?: number;
};

export type LeadImportRequestVerification =
  | { ok: true; auth: LeadImportRequestHeaders; requestId: string | null }
  | { ok: false; response: ReturnType<typeof leadImportUnauthorizedResponse> | ReturnType<typeof leadImportUnsupportedMediaTypeResponse> };

function bodyIsEmpty(body: string | Uint8Array) {
  return typeof body === "string" ? body.length === 0 : body.byteLength === 0;
}

export function verifyLeadImportTransportRequest({
  headers,
  contentType,
  body,
  method,
  path,
  hmacSecret,
  now,
  maxClockSkewMs = DEFAULT_LEAD_IMPORT_MAX_CLOCK_SKEW_MS,
}: LeadImportRequestVerifierInput): LeadImportRequestVerification {
  const normalizedMethod = method.trim().toUpperCase();
  const signedEmptyGet = normalizedMethod === "GET" && bodyIsEmpty(body) && !contentType;

  if (!signedEmptyGet && !isLeadImportJsonContentType(contentType)) {
    return { ok: false, response: leadImportUnsupportedMediaTypeResponse() };
  }

  try {
    const transport = readLeadImportTransportHeaders(headers);
    const verification = verifyLeadImportRequest({
      headers: transport.auth,
      body,
      method: normalizedMethod,
      path,
      hmacSecret,
      now,
      maxClockSkewMs,
    });

    if (!verification.ok) return { ok: false, response: leadImportUnauthorizedResponse() };
    return { ok: true, auth: verification.headers, requestId: transport.requestId };
  } catch {
    return { ok: false, response: leadImportUnauthorizedResponse() };
  }
}
