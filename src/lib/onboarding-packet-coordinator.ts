import "server-only";
import { db } from "@/lib/db";
import { env, onboardingPacketCoordinatorEnabled } from "@/lib/env";
import { onboardingPacketEmail } from "@/lib/emails/onboarding-packet-email";
import type { OnboardingDocumentType, SentDocument } from "@/lib/ghl-documents";
import { sendDocumentTemplate } from "@/lib/ghl-documents";
import { logIntegrationError } from "@/lib/ghl-webhook";
import { sendMail } from "@/lib/mail";
import { resolveDispatchDecision, type DocumentSendResult } from "@/lib/onboarding-packet-dispatch-policy";

const DOCUMENT_ORDER: { type: OnboardingDocumentType; label: string; templateId: string }[] = [
  { type: "SALES_AGREEMENT", label: "Sales Partner Agreement", templateId: env.ghl.templateIds.salesAgreement },
  { type: "NDA_IP", label: "Confidentiality and IP Agreement", templateId: env.ghl.templateIds.ndaIp },
  { type: "W9_PAYOUT", label: "W-9 / Payout Intake", templateId: env.ghl.templateIds.w9Payout },
  { type: "ACKNOWLEDGMENT", label: "New Hire Acknowledgment", templateId: env.ghl.templateIds.acknowledgment },
];

export type DispatchOutcome =
  | { ok: true; emailDelivered: boolean; documents: SentDocument[] }
  | { ok: false; reason: string; failures: { documentType: OnboardingDocumentType; error: string }[] };

/**
 * Option B: sends all four onboarding documents via GHL's Send Template API and, only if
 * every one succeeds, emails the agent a single message containing all four secure links.
 *
 * NOT WIRED INTO ANY LIVE FLOW YET. Nothing in the codebase calls this function. Gated by
 * ONBOARDING_PACKET_COORDINATOR_ENABLED (default false, see .env.example) as a second,
 * independent safety check even after it is wired in.
 *
 * Before enabling in production:
 *   1. Run one real GHL Send Template call against a disposable/synthetic contact and
 *      confirm the field mapping in src/lib/ghl-documents.ts actually matches the live
 *      response (documented but not yet verified from this environment).
 *   2. Disable/unpublish the native "Agent Onboarding Documents" GHL workflow's four
 *      Send Document actions, or applicants will receive both the native four emails and
 *      this one composed email for the same documents.
 * See docs/ONBOARDING_PACKET_COORDINATOR.md for the full status and gate list.
 */
export async function dispatchOnboardingPacket(input: {
  agentId: string;
  ghlContactId: string;
  recipientName: string;
  recipientEmail: string;
}): Promise<DispatchOutcome> {
  if (!onboardingPacketCoordinatorEnabled) {
    return { ok: false, reason: "ONBOARDING_PACKET_COORDINATOR_ENABLED is false.", failures: [] };
  }

  const attempts = await Promise.all(
    DOCUMENT_ORDER.map(async (doc): Promise<DocumentSendResult> => {
      const result = await sendDocumentTemplate({
        templateId: doc.templateId,
        documentType: doc.type,
        contactId: input.ghlContactId,
      });
      return result.ok
        ? { documentType: doc.type, ok: true, ghlDocumentId: result.data.ghlDocumentId, signingUrl: result.data.signingUrl }
        : { documentType: doc.type, ok: false, error: result.error };
    }),
  );

  const decision = resolveDispatchDecision(attempts);

  if (!decision.sendEmail) {
    await Promise.allSettled(
      decision.failures.map((failure) =>
        logIntegrationError({
          source: "ghl.onboarding-packet-coordinator",
          refId: input.agentId,
          message: failure.error,
          payload: { agentId: input.agentId, documentType: failure.documentType },
        }),
      ),
    );
    return {
      ok: false,
      reason: "One or more documents failed to send; no email was sent (fail closed).",
      failures: decision.failures,
    };
  }

  const linksByLabel = new Map(DOCUMENT_ORDER.map((doc) => [doc.type, doc.label]));
  const links = decision.links.map((link) => ({
    label: linksByLabel.get(link.documentType) ?? link.documentType,
    url: link.signingUrl,
  }));

  const { subject, text, html } = onboardingPacketEmail({ recipientName: input.recipientName, links });
  const delivery = await sendMail({ to: input.recipientEmail, subject, text, html });

  if (!delivery.ok) {
    await logIntegrationError({ source: "onboarding-packet-email", refId: input.agentId, message: delivery.error });
  }

  await db.auditLog.create({
    data: {
      actionType: "ONBOARDING_PACKET_DISPATCHED",
      entityType: "Agent",
      entityId: input.agentId,
      metadata: {
        documentIds: decision.links.map((link) => link.ghlDocumentId),
        emailDelivered: delivery.ok && !delivery.stub,
      },
    },
  });

  return {
    ok: true,
    emailDelivered: delivery.ok && !delivery.stub,
    documents: decision.links,
  };
}
