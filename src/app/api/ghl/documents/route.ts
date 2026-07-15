import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { createActivation } from "@/lib/activation";
import { evaluateAgentActivation } from "@/lib/agent-activation-policy";
import { db } from "@/lib/db";
import { activationEmail } from "@/lib/emails/activation-email";
import {
  finishInboundEvent,
  ghlWebhookJson,
  logGhlWebhookRuntimeFailure,
  logIntegrationError,
  prepareGhlWebhookRequest,
  recordInboundEvent,
  requestIp,
  sanitizedGhlWebhookFailure,
  verifyGhlWebhookLocation,
} from "@/lib/ghl-webhook";
import { sendMail } from "@/lib/mail";

const requiredDocuments = ["SALES_AGREEMENT", "NDA_IP", "W9_PAYOUT", "ACKNOWLEDGMENT"] as const;

const webhookSchema = z.object({
  ghl_event_id: z.string().trim().min(1),
  location_id: z.string().trim().min(1),
  ghl_contact_id: z.string().trim().min(1).optional(),
  mini_crm_agent_id: z.string().cuid().optional(),
  document_type: z.enum(["SALES_AGREEMENT", "NDA_IP", "W9", "W9_PAYOUT", "ACKNOWLEDGMENT"]),
  status: z.string().trim().transform((value) => value.toUpperCase()),
  document_id: z.string().trim().min(1).optional(),
  signer_ip: z.string().trim().max(128).optional(),
  countersigned: z.boolean().optional().default(false),
  completed_at: z.string().datetime().optional(),
}).refine((value) => Boolean(value.ghl_contact_id || value.mini_crm_agent_id), {
  message: "A Mini CRM agent id or GHL contact id is required.",
});

function docType(value: z.infer<typeof webhookSchema>["document_type"]) {
  return value === "W9" ? "W9_PAYOUT" : value;
}

export async function POST(request: NextRequest) {
  const prepared = await prepareGhlWebhookRequest(request);
  if (!prepared.ok) return prepared.response;
  const { raw, requestId } = prepared;

  const parsed = webhookSchema.safeParse(raw);
  if (!parsed.success) return ghlWebhookJson({ error: "Invalid webhook payload." }, 422, requestId);
  const payload = parsed.data;
  const verified = verifyGhlWebhookLocation(payload.location_id);
  if (!verified.ok) {
    if (verified.status === 202) {
      await logIntegrationError({
        source: "ghl.documents",
        refId: payload.ghl_event_id,
        message: verified.message,
        payload: { requestId, locationId: payload.location_id },
      }).catch(() => undefined);
    }
    return ghlWebhookJson({ error: verified.message }, verified.status, requestId);
  }

  const recorded = await recordInboundEvent({
    ghlEventId: payload.ghl_event_id,
    locationId: payload.location_id,
    type: "documents.completed",
    payload: raw as Prisma.InputJsonValue,
  });
  if (!recorded.firstTime) return ghlWebhookJson({ ok: true, duplicate: true }, 200, requestId);

  try {
    if (payload.status !== "COMPLETED") {
      await finishInboundEvent(payload.ghl_event_id, "PROCESSED");
      return ghlWebhookJson({ ok: true, ignored: true }, 200, requestId);
    }

    const agent = payload.mini_crm_agent_id
      ? await db.agent.findUnique({ where: { id: payload.mini_crm_agent_id } })
      : await db.agent.findFirst({ where: { ghlContactId: payload.ghl_contact_id } });

    if (!agent) {
      await logIntegrationError({
        source: "ghl.documents",
        refId: payload.ghl_contact_id ?? payload.mini_crm_agent_id,
        message: "No Mini CRM agent matched the document webhook.",
        payload: { requestId, ghlEventId: payload.ghl_event_id },
      });
      await finishInboundEvent(payload.ghl_event_id, "ERROR");
      return ghlWebhookJson({ ok: true, unmatched: true }, 202, requestId);
    }

    const completedAt = payload.completed_at ? new Date(payload.completed_at) : new Date();
    const type = docType(payload.document_type);

    await db.$transaction([
      db.onboardingDocument.upsert({
        where: { agentId_docType: { agentId: agent.id, docType: type } },
        create: {
          agentId: agent.id,
          docType: type,
          status: "COMPLETED",
          ghlDocumentId: payload.document_id,
          signerIp: payload.signer_ip,
          countersigned: payload.countersigned,
          completedAt,
        },
        update: {
          status: "COMPLETED",
          ghlDocumentId: payload.document_id,
          signerIp: payload.signer_ip,
          countersigned: payload.countersigned,
          completedAt,
        },
      }),
      db.auditLog.create({
        data: {
          actionType: "ONBOARDING_DOCUMENT_COMPLETED",
          entityType: "Agent",
          entityId: agent.id,
          ipAddress: requestIp(request),
          metadata: { documentType: type, ghlEventId: payload.ghl_event_id },
        },
      }),
    ]);

    const current = await db.agent.findUnique({
      where: { id: agent.id },
      include: { onboardingDocs: true },
    });
    if (!current) throw new Error("Agent disappeared during document processing.");

    const completed = new Map(current.onboardingDocs.map((document) => [document.docType, document]));
    const fourGatesComplete = requiredDocuments.every((required) => completed.get(required)?.status === "COMPLETED");
    const agreementCountersigned = completed.get("SALES_AGREEMENT")?.countersigned === true;

    const activationPolicy = evaluateAgentActivation({
      agentApproved: current.status === "APPROVED",
      documentsComplete: fourGatesComplete,
      agreementCountersigned,
      w9Verified: Boolean(current.w9VerifiedAt),
      profileComplete: Boolean(current.profileCompletedAt),
      trainingComplete: Boolean(current.trainingCompletedAt),
      provisioned: Boolean(current.userId),
    });

    if (!activationPolicy.mayIssueActivation) {
      await finishInboundEvent(payload.ghl_event_id, "PROCESSED");
      return ghlWebhookJson({
        ok: true,
        provisioned: false,
        gatesComplete: fourGatesComplete,
        countersigned: agreementCountersigned,
        approved: current.status === "APPROVED",
        activationState: activationPolicy.state,
        missingInternalGates: activationPolicy.missingInternalGates,
      }, 200, requestId);
    }

    const existingUser = await db.user.findUnique({ where: { email: current.personalEmail } });
    if (existingUser && existingUser.role !== "AGENT") {
      await logIntegrationError({
        source: "ghl.documents",
        refId: current.id,
        message: "Cannot provision agent: email belongs to a privileged Mini CRM user.",
        payload: { requestId, ghlEventId: payload.ghl_event_id },
      });
      await finishInboundEvent(payload.ghl_event_id, "ERROR");
      return ghlWebhookJson({ ok: true, conflict: true }, 202, requestId);
    }

    let user = existingUser;
    if (!user) {
      try {
        user = await db.user.create({
          data: { email: current.personalEmail, role: "AGENT", status: "INVITED" },
        });
      } catch (error) {
        // Two document-completion webhooks landing concurrently can both reach this point
        // for the same agent; the loser of the race just picks up the winner's user row.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          user = await db.user.findUniqueOrThrow({ where: { email: current.personalEmail } });
        } else {
          throw error;
        }
      }
    }
    await db.$transaction([
      db.agent.update({
        where: { id: current.id },
        data: { userId: user.id, provisionedAt: new Date() },
      }),
      db.auditLog.create({
        data: {
          actorUserId: user.id,
          actorRole: "AGENT",
          actionType: "AGENT_PROVISIONED",
          entityType: "Agent",
          entityId: current.id,
          metadata: { source: "ghl.documents", ghlEventId: payload.ghl_event_id },
        },
      }),
    ]);

    const activation = await createActivation(user.id);
    const { subject, text, html } = activationEmail({
      activationUrl: activation.url,
      expiresAt: activation.expiresAt,
    });
    const delivery = await sendMail({ to: user.email, subject, text, html });

    await db.$transaction([
      db.auditLog.create({
        data: {
          actorUserId: user.id,
          actorRole: "AGENT",
          actionType: "ACTIVATION_LINK_ISSUED",
          entityType: "User",
          entityId: user.id,
          metadata: {
            delivery: delivery.ok ? (delivery.stub ? "smtp-not-configured" : "smtp-sent") : "smtp-failed",
            deliveryError: delivery.ok ? null : delivery.error,
            expiresAt: activation.expiresAt.toISOString(),
          },
        },
      }),
      db.webhookEvent.update({
        where: { ghlEventId: payload.ghl_event_id },
        data: { status: "PROCESSED", processedAt: new Date() },
      }),
    ]);

    if (!delivery.ok) {
      await logIntegrationError({
        source: "activation.email",
        refId: user.id,
        message: delivery.error,
      });
    }

    // Do not echo the one-time activation URL back in the webhook response body —
    // it's a bearer credential and GHL's webhook delivery log would retain it.
    return ghlWebhookJson({ ok: true, provisioned: true, emailDelivered: delivery.ok && !delivery.stub }, 200, requestId);
  } catch (error) {
    const failure = sanitizedGhlWebhookFailure(error);
    logGhlWebhookRuntimeFailure({ source: "ghl.documents", requestId, refId: payload.ghl_event_id, error });
    await Promise.allSettled([
      finishInboundEvent(payload.ghl_event_id, "ERROR"),
      logIntegrationError({
        source: "ghl.documents",
        refId: payload.ghl_event_id,
        message: "GHL document webhook processing failed.",
        payload: { requestId, ...failure },
      }),
    ]);
    return ghlWebhookJson({ error: "Webhook processing failed." }, 500, requestId);
  }
}
