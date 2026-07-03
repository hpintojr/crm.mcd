import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { leadImportRequestHeadersSchema, type LeadImportRequestHeaders } from "@/lib/lead-import-contract";

/**
 * HMAC utilities for the future local mcd_lead_ops import API.
 *
 * These utilities are deliberately independent of a database or HTTP framework,
 * which makes their canonical-string behavior testable before the import tables
 * and route handlers are introduced. Use only from server-side code.
 */

export const DEFAULT_LEAD_IMPORT_MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

type SignedRequestInput = {
  keyId: string;
  timestamp: string;
  method: string;
  path: string;
  bodySha256: string;
};

export type LeadImportSignatureVerification =
  | { ok: true; headers: LeadImportRequestHeaders }
  | { ok: false; reason: "MALFORMED_HEADERS" | "EXPIRED" | "BODY_HASH_MISMATCH" | "SIGNATURE_MISMATCH" };

export function sha256Hex(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalLeadImportRequest({ keyId, timestamp, method, path, bodySha256 }: SignedRequestInput) {
  return [keyId.trim(), timestamp.trim(), method.trim().toUpperCase(), path.trim(), bodySha256.trim().toLowerCase()].join("\n");
}

export function signLeadImportRequest(input: SignedRequestInput, hmacSecret: string) {
  if (!hmacSecret) throw new Error("A non-empty lead import HMAC secret is required.");
  return createHmac("sha256", hmacSecret)
    .update(canonicalLeadImportRequest(input))
    .digest("hex");
}

function signaturesMatch(expected: string, received: string) {
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function verifyLeadImportRequest({
  headers,
  body,
  method,
  path,
  hmacSecret,
  now = Date.now(),
  maxClockSkewMs = DEFAULT_LEAD_IMPORT_MAX_CLOCK_SKEW_MS,
}: {
  headers: unknown;
  body: string | Uint8Array;
  method: string;
  path: string;
  hmacSecret: string;
  now?: number;
  maxClockSkewMs?: number;
}): LeadImportSignatureVerification {
  const parsed = leadImportRequestHeadersSchema.safeParse(headers);
  if (!parsed.success || !hmacSecret || !Number.isFinite(maxClockSkewMs) || maxClockSkewMs < 0) {
    return { ok: false, reason: "MALFORMED_HEADERS" };
  }

  const requestHeaders = parsed.data;
  const timestamp = Number(requestHeaders.timestamp);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > maxClockSkewMs) {
    return { ok: false, reason: "EXPIRED" };
  }

  const actualBodyHash = sha256Hex(body);
  if (!signaturesMatch(actualBodyHash, requestHeaders.bodySha256)) {
    return { ok: false, reason: "BODY_HASH_MISMATCH" };
  }

  const expectedSignature = signLeadImportRequest({
    keyId: requestHeaders.keyId,
    timestamp: requestHeaders.timestamp,
    method,
    path,
    bodySha256: requestHeaders.bodySha256,
  }, hmacSecret);

  if (!signaturesMatch(expectedSignature, requestHeaders.signature)) {
    return { ok: false, reason: "SIGNATURE_MISMATCH" };
  }

  return { ok: true, headers: requestHeaders };
}
