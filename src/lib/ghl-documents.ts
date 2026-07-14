// GoHighLevel Documents & Contracts API client (server-only).
//
// Used only by the onboarding packet coordinator (Option B). Not called anywhere yet —
// see docs/ONBOARDING_PACKET_COORDINATOR.md before wiring this into a live flow.
//
// NOT YET LIVE-VERIFIED: the response field names read below for the document id and the
// recipient-facing secure signing link are this module's best-effort mapping from
// HighLevel's published Documents & Contracts "Send Template" contract
// (https://marketplace.gohighlevel.com/docs/ghl/proposals/documents-and-contracts-api/index.html).
// This repo has no live credential to test that response shape from this environment.
// Before ONBOARDING_PACKET_COORDINATOR_ENABLED is ever set to true in production, run one
// real Send Template call against a disposable/synthetic contact and confirm the field
// names in extractString() below actually match. If they don't, this function fails
// closed (returns ok:false) rather than sending a broken or empty link.

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
