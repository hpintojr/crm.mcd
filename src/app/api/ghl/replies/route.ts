import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import {
  finishInboundEvent,
  ghlWebhookJson,
  logGhlWebhookRuntimeFailure,
  logIntegrationError,
  prepareGhlWebhookRequest,
  requestIp,
  sanitizedGhlWebhookFailure,
  verifyGhlWebhookLocation,
} from "@/lib/ghl-webhook";
import { relayGhlInboundReply } from "@/lib/ghl-inbound-reply-relay";

const optionalText = (max: number) => z.preprocess((value) => typeof value === "string" && !value.trim() ? undefined : value, z.string().trim().max(max).optional());
const schema = z.object({
  ghl_event_id: z.string().trim().min(1),
  location_id: z.string().trim().min(1),
  channel: z.enum(["EMAIL", "SMS"]),
  message: z.string().trim().min(1).max(4_000),
  ghl_contact_id: optionalText(200),
  mini_crm_lead_id: optionalText(100),
  from_email: optionalText(320),
  from_phone: optionalText(100),
  received_at: optionalText(200),
}).passthrough().superRefine((value, context) => {
  if (!value.mini_crm_lead_id && !value.ghl_contact_id && !value.from_email && !value.from_phone) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Provide a MiniCRM Lead ID, GHL contact ID, email, or phone for matching." });
  }
});

export async function POST(request: NextRequest) {
  const prepared = await prepareGhlWebhookRequest(request);
  if (!prepared.ok) return prepared.response;
  const { raw, requestId } = prepared;

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return ghlWebhookJson({ error: "Invalid inbound reply webhook payload." }, 422, requestId);
  const payload = parsed.data;
  const verified = verifyGhlWebhookLocation(payload.location_id);
  if (!verified.ok) return ghlWebhookJson({ error: verified.message }, verified.status, requestId);

  try {
    const result = await relayGhlInboundReply({
      ghlEventId: payload.ghl_event_id,
      locationId: payload.location_id,
      channel: payload.channel,
      message: payload.message,
      ghlContactId: payload.ghl_contact_id,
      miniCrmLeadId: payload.mini_crm_lead_id,
      fromEmail: payload.from_email,
      fromPhone: payload.from_phone,
      receivedAt: payload.received_at,
      rawPayload: raw as Prisma.InputJsonValue,
      ipAddress: requestIp(request),
    });
    if (result.duplicate) return ghlWebhookJson({ ok: true, duplicate: true }, 200, requestId);
    await finishInboundEvent(payload.ghl_event_id, "PROCESSED");
    return ghlWebhookJson({ ok: true, relayed: true, leadMatched: result.leadMatched, leadGated: result.leadGated, leadIgnored: result.leadIgnored, callbackCreated: result.callbackCreated, callbackExpedited: result.callbackExpedited }, 200, requestId);
  } catch (error) {
    const failure = sanitizedGhlWebhookFailure(error);
    logGhlWebhookRuntimeFailure({ source: "ghl.replies", requestId, refId: payload.ghl_event_id, error });
    await Promise.allSettled([
      finishInboundEvent(payload.ghl_event_id, "ERROR"),
      logIntegrationError({
        source: "ghl.replies",
        refId: payload.ghl_event_id,
        message: "GHL inbound reply webhook processing failed.",
        payload: { requestId, ...failure },
      }),
    ]);
    return ghlWebhookJson({ error: "Inbound reply webhook processing failed." }, 500, requestId);
  }
}
