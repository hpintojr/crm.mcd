import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import {
  finishInboundEvent,
  ghlWebhookJson,
  logGhlWebhookRuntimeFailure,
  logIntegrationError,
  prepareGhlWebhookRequest,
  recordInboundEvent,
  sanitizedGhlWebhookFailure,
  verifyGhlWebhookLocation,
} from "@/lib/ghl-webhook";

const schema = z.object({ ghl_event_id: z.string().min(1), location_id: z.string().min(1) }).passthrough();

export async function POST(request: NextRequest) {
  const prepared = await prepareGhlWebhookRequest(request);
  if (!prepared.ok) return prepared.response;
  const { raw, requestId } = prepared;

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return ghlWebhookJson({ error: "Invalid webhook payload." }, 422, requestId);
  const verified = verifyGhlWebhookLocation(parsed.data.location_id);
  if (!verified.ok) return ghlWebhookJson({ error: verified.message }, verified.status, requestId);

  try {
    const event = await recordInboundEvent({
      ghlEventId: parsed.data.ghl_event_id,
      locationId: parsed.data.location_id,
      type: "funding",
      payload: raw as Prisma.InputJsonValue,
    });
    if (!event.firstTime) return ghlWebhookJson({ ok: true, duplicate: true }, 200, requestId);
    await finishInboundEvent(parsed.data.ghl_event_id, "PROCESSED");
    return ghlWebhookJson({ ok: true, queued: true }, 200, requestId);
  } catch (error) {
    const failure = sanitizedGhlWebhookFailure(error);
    logGhlWebhookRuntimeFailure({ source: "ghl.funding", requestId, refId: parsed.data.ghl_event_id, error });
    await logIntegrationError({
      source: "ghl.funding",
      refId: parsed.data.ghl_event_id,
      message: "GHL funding webhook processing failed.",
      payload: { requestId, ...failure },
    }).catch(() => undefined);
    return ghlWebhookJson({ error: "Webhook processing failed." }, 500, requestId);
  }
}
