// GoHighLevel Documents & Contracts API client (server-only).
//
// Used only by the onboarding packet coordinator (Option B). Not called anywhere yet —
// see docs/ONBOARDING_PACKET_COORDINATOR.md before wiring this into a live flow.
//
// LIVE-VERIFIED (2026-07-14): logged into the MCD GHL sub-account directly and confirmed
// the four templates below are real, published, and reachable at this module's
// `services.leadconnectorhq.com/proposals/...` path family. Sent one real document
// ("MCD - New Hire Acknowledgment") through the GHL web UI to a disposable test contact
// and confirmed it moved to "Sent" — the template, contact, and delivery model this
// module assumes are all correct.
//
// STILL UNVERIFIED: the exact JSON field names read below for the document id and the
// recipient-facing secure signing link. Sending through the web UI does not necessarily
// exercise the same response shape as this module's direct API call, and a live capture
// of that specific API response was not achievable from this session (see
// docs/ONBOARDING_PACKET_COORDINATOR.md for why). This remains a best-effort mapping from
// HighLevel's published Documents & Contracts "Send Template" contract
// (https://marketplace.gohighlevel.com/docs/ghl/proposals/documents-and-contracts-api/index.html).
// Before ONBOARDING_PACKET_COORDINATOR_ENABLED is ever set to true in production, run one
// real Send Template call (e.g. via curl/script from an environment holding
// GHL_PRIVATE_TOKEN) against a disposable/synthetic contact and confirm the field names in
// extractString() below actually match. If they don't, this function fails closed
// (returns ok:false) rather than sending a broken or empty link.
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

function headers() {
  return {
    Authorization: `Bearer ${env.ghl.token}`,
    Version: env.ghl.apiVersion,
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
 * returns the recipient-facing secure signing link from that same response — no polling.
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

  try {
    const res = await fetch(
      `${env.ghl.apiBase}/proposals/templates/${encodeURIComponent(input.templateId)}/send`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          locationId: env.ghl.salesHqLocationId,
          contactId: input.contactId,
        }),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        error: `GHL send-template failed for ${input.documentType} (${res.status}): ${text.slice(0, 300)}`,
      };
    }

    const json = (await res.json()) as Record<string, unknown>;
    const documentId = extractString(json, ["documentId", "id", "document.id"]);
    const signingUrl = extractString(json, [
      "url",
      "link",
      "documentUrl",
      "signUrl",
      "publicUrl",
      "document.url",
      "document.publicUrl",
    ]);

    if (!documentId || !signingUrl) {
      return {
        ok: false,
        error:
          `GHL send-template response for ${input.documentType} did not include a recognizable ` +
          "document id / signing url. The field mapping in extractString() needs to be verified " +
          "against a real response before this path can be trusted — see docs/ONBOARDING_PACKET_COORDINATOR.md.",
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
