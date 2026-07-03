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
 * Pure request-verification boundary for the future paid-data import API.
 *
 * This module does not create a route, load environment variables, access a
 * database, or submit leads. A future server handler must provide the raw body
 * and resolved key secret after looking it up through durable import records.
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

export type VerifiedLeadImportRequest = {
  ok: true;
  auth: LeadImportRequestHeaders;
  requestId: string | null;
};

export type RejectedLeadImportRequest = {
  ok: false;
  response: ReturnType<typeof leadImportUnauthorizedResponse> | ReturnType<typeof leadImportUnsupportedMediaTypeResponse>;
};

export type LeadImportRequestVerification = VerifiedLeadImportRequest | RejectedLeadImportRequest;

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

    if (!verification.ok) {
      return { ok: false, response: leadImportUnauthorizedResponse() };
    }

    return {
      ok: true,
      auth: verification.headers,
      requestId: transport.requestId,
    };
  } catch {
    return { ok: false, response: leadImportUnauthorizedResponse() };
  }
}
