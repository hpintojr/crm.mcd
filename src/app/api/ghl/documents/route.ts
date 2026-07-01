import { NextRequest, NextResponse } from "next/server";
import { hasValidGhlWebhookSecret } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { ghlDocumentWebhookSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Receives the internal GHL document-completion event. Configure each GHL workflow
 * to send x-mcd-webhook-secret plus: event, contactId (or agentId), documentId,
 * and the matching MCD docType.
 */
export async function POST(req: NextRequest) {
  if (!hasValidGhlWebhookSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ghlDocumentWebhookSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid document event.", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const event = parsed.data;
  const normalizedEvent = event.event.toLowerCase();
  const isCompletion = normalizedEvent.includes("completed") || normalizedEvent.includes("signed");

  if (!isCompletion) {
    return NextResponse.json({ ok: true, ignored: true, reason: "Event is not a completion." });
  }

  const agent = event.agentId
    ? await db.agent.findUnique({
        where: { id: event.agentId },
        select: { id: true, ghlContactId: true, status: true },
      })
    : await db.agent.findFirst({
        where: { ghlContactId: event.contactId },
        select: { id: true, ghlContactId: true, status: true },
      });

  if (!agent) {
    return NextResponse.json({ error: "No agent matches this document event." }, { status: 404 });
  }

  if (event.contactId && agent.ghlContactId && event.contactId !== agent.ghlContactId) {
    return NextResponse.json({ error: "Agent and contact identifiers do not match." }, { status: 409 });
  }

  const onboardingDocument = await db.onboardingDocument.findUnique({
    where: {
      agentId_docType: {
        agentId: agent.id,
        docType: event.docType,
      },
    },
    select: { id: true, status: true, ghlDocumentId: true },
  });

  if (!onboardingDocument) {
    return NextResponse.json({ error: "Onboarding document gate not found." }, { status: 404 });
  }

  const completedAt = event.completedAt ?? new Date();
  const isIdempotent =
    onboardingDocument.status === "COMPLETED" &&
    (!event.documentId || onboardingDocument.ghlDocumentId === event.documentId);

  if (!isIdempotent) {
    await db.$transaction([
      db.onboardingDocument.update({
        where: { id: onboardingDocument.id },
        data: {
          status: "COMPLETED",
          ghlDocumentId: event.documentId ?? onboardingDocument.ghlDocumentId,
          completedAt,
        },
      }),
      db.auditLog.create({
        data: {
          actorRole: "GHL_WEBHOOK",
          actionType: "ONBOARDING_DOCUMENT_COMPLETED",
          entityType: "OnboardingDocument",
          entityId: onboardingDocument.id,
          metadata: {
            agentId: agent.id,
            docType: event.docType,
            ghlDocumentId: event.documentId ?? null,
            event: event.event,
          },
        },
      }),
    ]);
  }

  const remaining = await db.onboardingDocument.count({
    where: {
      agentId: agent.id,
      status: { not: "COMPLETED" },
    },
  });

  return NextResponse.json({
    ok: true,
    idempotent: isIdempotent,
    agentId: agent.id,
    docType: event.docType,
    readyForActivation: remaining === 0,
  });
}
