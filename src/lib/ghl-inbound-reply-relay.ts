import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { recordInboundEvent } from "@/lib/ghl-webhook";
import { attributeInboundReplyToLead } from "@/lib/lead-inbound-reply-attribution";

export type GhlInboundReplyRelayInput = {
  ghlEventId: string;
  locationId: string;
  channel: "EMAIL" | "SMS";
  message: string;
  ghlContactId?: string;
  miniCrmLeadId?: string;
  fromEmail?: string;
  fromPhone?: string;
  receivedAt?: string;
  rawPayload: Prisma.InputJsonValue;
  ipAddress?: string | null;
};

export async function relayGhlInboundReply(input: GhlInboundReplyRelayInput) {
  const event = await recordInboundEvent({ ghlEventId: input.ghlEventId, locationId: input.locationId, type: "replies.inbound", payload: input.rawPayload });
  if (!event.firstTime) return { duplicate: true, leadMatched: false, leadGated: false, leadIgnored: false, callbackCreated: false, callbackExpedited: false };

  const attribution = await attributeInboundReplyToLead({
    ghlEventId: input.ghlEventId,
    channel: input.channel,
    message: input.message,
    ghlContactId: input.ghlContactId,
    miniCrmLeadId: input.miniCrmLeadId,
    fromEmail: input.fromEmail,
    fromPhone: input.fromPhone,
    receivedAt: input.receivedAt,
  });
  await db.auditLog.create({
    data: {
      actionType: "GHL_INBOUND_REPLY_RELAYED",
      entityType: "WebhookEvent",
      entityId: input.ghlEventId,
      ipAddress: input.ipAddress ?? null,
      metadata: { leadMatched: attribution.matched, leadGated: attribution.gated, leadIgnored: attribution.ignored, callbackCreated: attribution.callbackCreated, callbackExpedited: attribution.callbackExpedited, channel: input.channel },
    },
  });
  return { duplicate: false, leadMatched: attribution.matched, leadGated: attribution.gated, leadIgnored: attribution.ignored, callbackCreated: attribution.callbackCreated, callbackExpedited: attribution.callbackExpedited };
}
