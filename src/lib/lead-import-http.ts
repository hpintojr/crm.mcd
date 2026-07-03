import { leadImportRequestHeadersSchema, type LeadImportRequestHeaders } from "@/lib/lead-import-contract";

/** Transport-only helpers for the future signed lead-import route family. */

export const leadImportHeaderNames = {
  keyId: "x-mcd-import-key-id",
  timestamp: "x-mcd-import-timestamp",
  bodySha256: "x-mcd-import-body-sha256",
  signature: "x-mcd-import-signature",
  requestId: "x-mcd-import-request-id",
} as const;

export type LeadImportRequestHeaderInput = { get(name: string): string | null };
export type LeadImportTransportHeaders = { auth: LeadImportRequestHeaders; requestId: string | null };

export function readLeadImportTransportHeaders(headers: LeadImportRequestHeaderInput): LeadImportTransportHeaders {
  const auth = leadImportRequestHeadersSchema.parse({
    keyId: headers.get(leadImportHeaderNames.keyId) ?? "",
    timestamp: headers.get(leadImportHeaderNames.timestamp) ?? "",
    bodySha256: headers.get(leadImportHeaderNames.bodySha256) ?? "",
    signature: headers.get(leadImportHeaderNames.signature) ?? "",
  });
  const requestId = headers.get(leadImportHeaderNames.requestId)?.trim() || null;
  return { auth, requestId };
}

export function isLeadImportJsonContentType(contentType: string | null) {
  return Boolean(contentType && contentType.split(";", 1)[0]?.trim().toLowerCase() === "application/json");
}

export function leadImportUnauthorizedResponse() {
  return { status: 401, code: "LEAD_IMPORT_UNAUTHORIZED", message: "The signed lead-import request could not be authenticated." } as const;
}

export function leadImportUnsupportedMediaTypeResponse() {
  return { status: 415, code: "LEAD_IMPORT_UNSUPPORTED_MEDIA_TYPE", message: "Lead-import requests must use application/json." } as const;
}
