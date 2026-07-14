// GoHighLevel Documents & Contracts API client (server-only).
//
// Used only by the onboarding packet coordinator (Option B). Not called anywhere yet —
// see docs/ONBOARDING_PACKET_COORDINATOR.md before wiring this into a live flow.
//
// LIVE-VERIFIED (2026-07-14): logged into the MCD GHL sub-account directly, confirmed the
// four templates below are real/published, sent one real document through the web UI, and
// then ran a real server-side script call against the public API with a real
// GHL_PRIVATE_TOKEN. That confirmed the real Send Template request/response contract used
// below: POST /proposals/templates/send (templateId in the body, not the URL path),
// required userId + sendDocument fields, and a Version: v3 header (not the app's general
// GHL_API_VERSION default of 2021-07-28).
//
// CRITICAL FINDING (2026-07-14): the real Send Template response — and the real List
// Documents response for the same document — were both captured live and contain NO
// url/link/signUrl/publicUrl field anywhere. Only internal ids are returned
// (documentId, links[]._id, links[].referenceId; links[].recipientId is just the contact
// id, not a link id). extractString() below will therefore always fail to find a signing
// URL against the real API and this function will always return ok:false — this is
// intentional fail-closed behavior, not a bug to "fix" by adjusting field paths.
//
// A real recipient-facing URL DOES exist in this account — confirmed by clicking the GHL
// web UI's separate "Share via link" action (distinct from "Send Document"), which
// produced a link shaped like https://system.futureassistant.ai/documents/v1/<uuid>. But
// that uuid does not match documentId, links[]._id, links[].referenceId, or
// links[].recipientId from the real API responses above, so it is NOT derivable from this
// module's Send Template call. It's unconfirmed whether "Share via link" calls a
// documented public endpoint, an undocumented one, or a session-cookie-authenticated
// internal endpoint unreachable with a GHL_PRIVATE_TOKEN. See "Critical finding" in
// docs/ONBOARDING_PACKET_COORDINATOR.md for the full writeup and options going forward.
// Do not set ONBOARDING_PACKET_COORDINATOR_ENABLED=true until that gap is resolved —
// fixing this file alone cannot make sendDocumentTemplate() succeed against the real API.
//
// Real template ids confirmed live in the MCD account (see docs/ONBOARDING_PACKET_COORDINATOR.md):
//   SALES_AGREEMENT  -> 6a4586d766f3bacccf2a9ff7
//   NDA_IP           -> 6a458a0466f3ba56a42af191
//   W9_PAYOUT        -> 6a458b776a7ea4c86263dc3d
//   ACKNOWLEDGMENT   -> 6a458b37c17177da8ec5c7d0

import "server-only";
import { env, ghlConfigured } from "@/lib/env";
import type { GhlResult } from "@/lib/ghl";

export type OnboardingDocumentType = "SALES_AGREEMENT" | "NDA_IP" | "W9_PAYOUT" | "ACKNOWLEDGMENT";

export type SentDocument = {
  documentType: OnboardingDocumentType;
  ghlDocumentId: string;
  signingUrl: string;
};

// The Proposals/Documents v3 endpoint family requires "Version: v3" specifically. This is
// confirmed live and is different from the app's general GHL_API_VERSION default
// (2021-07-28), which other GHL endpoints in this app use. Do not switch this to
// env.ghl.apiVersion.
const PROPOSALS_API_VERSION = "v3";

function headers() {
  return {
    Authorization: `Bearer ${env.ghl.token}`,
    Version: PROPOSALS_API_VERSION,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/** Reads the first matching field from a shallow or one-level-nested response body. */
function extractString(body: Record<string, unknown>, paths: string[]): string | null {
  for (const path of paths) {
    const segments = path.split(".");
    let cursor: unknown = body;
    for (const segment of segments) {
      if (cursor && typeof cursor === "object" && segment in (cursor as Record<string, unknown>)) {
        cursor = (cursor as Record<string, unknown>)[segment];
      } else {
        cursor = undefined;
        break;
      }
    }
    if (typeof cursor === "string" && cursor.length > 0) return cursor;
  }
  return null;
}

/**
 * Creates and sends one onboarding document from a GHL template in a single call, and
 * attempts to read the recipient-facing secure signing link from that same response.
 *
 * KNOWN LIMITATION (confirmed live 2026-07-14): the real Send Template response does not
 * contain a signing URL at all, so this will currently always return ok:false once GHL is
 * configured — see the file header and docs/ONBOARDING_PACKET_COORDINATOR.md. Left
 * fail-closed on purpose: it must never fabricate or send a broken/missing link.
 *
 * Stub-safe: if GHL isn't configured, or the contact id is a synthetic `stub_` id, this
 * returns a deterministic fake link instead of calling GHL, so synthetic-data tests and
 * local development never make a network call.
 */
export async function sendDocumentTemplate(input: {
  templateId: string;
  documentType: OnboardingDocumentType;
  contactId: string;
}): Promise<GhlResult<SentDocument>> {
  if (!ghlConfigured || input.contactId.startsWith("stub_")) {
    return {
      ok: true,
      stub: true,
      data: {
        documentType: input.documentType,
        ghlDocumentId: `stub_doc_${input.documentType.toLowerCase()}_${Date.now()}`,
        signingUrl: `https://stub.mercurycalldesk.com/onboarding-doc/${input.documentType.toLowerCase()}`,
      },
    };
  }

  if (!input.templateId) {
    return { ok: false, error: `No GHL template id configured for ${input.documentType}.` };
  }

  if (!env.ghl.sendingUserId) {
    return {
      ok: false,
      error:
        "GHL_SENDING_USER_ID is not configured. The real Send Template API requires a userId " +
        "in the request body (confirmed live 2026-07-14 — omitting it returns 422).",
    };
  }

  try {
    const res = await fetch(`${env.ghl.apiBase}/proposals/templates/send`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        templateId: input.templateId,
        userId: env.ghl.sendingUserId,
        sendDocument: true,
        locationId: env.ghl.salesHqLocationId,
        contactId: input.contactId,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        error: `GHL send-template failed for ${input.documentType} (${res.status}): ${text.slice(0, 300)}`,
      };
    }

    const json = (await res.json()) as Record<string, unknown>;
    // Confirmed live shape: { success, links: [{ _id, referenceId, documentId, recipientId, ... }], traceId }
    const links = Array.isArray(json.links) ? (json.links as Record<string, unknown>[]) : [];
    const firstLink = links[0] ?? {};
    const documentId = extractString(firstLink, ["documentId"]) ?? extractString(json, ["documentId", "id"]);
    // No known field currently returns a signing URL — see file header. This search is
    // kept in case HighLevel adds one, but it is confirmed to always miss today.
    const signingUrl = extractString(json, [
      "url",
      "link",
      "documentUrl",
      "signUrl",
      "publicUrl",
      "document.url",
      "document.publicUrl",
    ]) ?? extractString(firstLink, ["url", "link", "signUrl", "publicUrl"]);

    if (!documentId || !signingUrl) {
      return {
        ok: false,
        error:
          `GHL send-template response for ${input.documentType} did not include a recognizable ` +
          "signing url. Confirmed live (2026-07-14): the real API response does not contain one " +
          "— see the 'Critical finding' section in docs/ONBOARDING_PACKET_COORDINATOR.md before " +
          "attempting to fix this by changing field paths.",
      };
    }

    return { ok: true, data: { documentType: input.documentType, ghlDocumentId: documentId, signingUrl } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "GHL send-template request error",
    };
  }
}
