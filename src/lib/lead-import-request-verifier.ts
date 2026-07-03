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
 * Pure verification boundary for a future paid-data import endpoint.
 * It does not create a route, load environment variables, resolve secrets,
 * access the database, or submit an import.
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
  if (!isLeadImportJsonContentType(contentType)) {
    return { ok: false, response: leadImportUnsupportedMediaTypeResponse() };
  }

  try {
    const transport = readLeadImportTransportHeaders(headers);
    const verification = verifyLeadImportRequest({
      headers: transport.auth,
      body,
      method,
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
