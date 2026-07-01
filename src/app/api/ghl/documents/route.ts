import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createActivation } from "@/lib/activation";
import { db } from "@/lib/db";
import {
  finishInboundEvent,
  logIntegrationError,
  recordInboundEvent,
  requestIp,
  verifyGhlWebhook,
} from "@/lib/ghl-webhook";

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
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = webhookSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 422 });
  }
  const payload = parsed.data;
  const verified = verifyGhlWebhook(request, payload.location_id);
  if (!verified.ok) {
    if (verified.status === 202) {
      await logIntegrationError({
        source: "ghl.documents",
        refId: payload.ghl_event_id,
        message: verified.message,
        payload: raw as Prisma.InputJsonValue,
      });
    }
    return NextResponse.json({ error: verified.message }, { status: verified.status });
  }

  const recorded = await recordInboundEvent({
    ghlEventId: payload.ghl_event_id,
    locationId: payload.location_id,
    type: "documents.completed",
    payload: raw as Prisma.InputJsonValue,
  });
  if (!recorded.firstTime) return NextResponse.json({ ok: true, duplicate: true });

  try {
    if (payload.status !== "COMPLETED") {
      await finishInboundEvent(payload.ghl_event_id, "PROCESSED");
      return NextResponse.json({ ok: true, ignored: true });
    }

    const agent = payload.mini_crm_agent_id
      ? await db.agent.findUnique({ where: { id: payload.mini_crm_agent_id } })
      : await db.agent.findFirst({ where: { ghlContactId: payload.ghl_contact_id } });

    if (!agent) {
      await logIntegrationError({
        source: "ghl.documents",
        refId: payload.ghl_contact_id ?? payload.mini_crm_agent_id,
        message: "No Mini CRM agent matched the document webhook.",
        payload: raw as Prisma.InputJsonValue,
      });
      await finishInboundEvent(payload.ghl_event_id, "ERROR");
      return NextResponse.json({ ok: true, unmatched: true }, { status: 202 });
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

    if (!fourGatesComplete || !agreementCountersigned || current.userId || current.status !== "APPROVED") {
      await finishInboundEvent(payload.ghl_event_id, "PROCESSED");
      return NextResponse.json({
        ok: true,
        provisioned: false,
        gatesComplete: fourGatesComplete,
        countersigned: agreementCountersigned,
        approved: current.status === "APPROVED",
      });
    }

    const existingUser = await db.user.findUnique({ where: { email: current.personalEmail } });
    if (existingUser && existingUser.role !== "AGENT") {
      await logIntegrationError({
        source: "ghl.documents",
        refId: current.id,
        message: "Cannot provision agent: email belongs to a privileged Mini CRM user.",
        payload: raw as Prisma.InputJsonValue,
      });
      await finishInboundEvent(payload.ghl_event_id, "ERROR");
      return NextResponse.json({ ok: true, conflict: true }, { status: 202 });
    }

    const user = existingUser ?? await db.user.create({
      data: { email: current.personalEmail, role: "AGENT", status: "INVITED" },
    });
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
    await db.$transaction([
      db.auditLog.create({
        data: {
          actorUserId: user.id,
          actorRole: "AGENT",
          actionType: "ACTIVATION_LINK_ISSUED",
          entityType: "User",
          entityId: user.id,
          metadata: { delivery: "webhook-response-stub", expiresAt: activation.expiresAt.toISOString() },
        },
      }),
      db.webhookEvent.update({
        where: { ghlEventId: payload.ghl_event_id },
        data: { status: "PROCESSED", processedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ ok: true, provisioned: true, activationUrl: activation.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown webhook processing failure.";
    await logIntegrationError({
      source: "ghl.documents",
      refId: payload.ghl_event_id,
      message,
      payload: raw as Prisma.InputJsonValue,
    });
    await finishInboundEvent(payload.ghl_event_id, "ERROR").catch(() => undefined);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
