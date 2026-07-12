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
import { relayGhlOpportunity } from "@/lib/ghl-opportunity-relay";

const optionalText = (max: number) => z.preprocess((value) => typeof value === "string" && !value.trim() ? undefined : value, z.string().trim().max(max).optional());
const schema = z.object({
  ghl_event_id: z.string().trim().min(1),
  location_id: z.string().trim().min(1),
  event_type: z.enum(["OPPORTUNITY_WON", "OPPORTUNITY_LOST"]),
  ghl_opportunity_id: z.string().trim().min(1),
  ghl_contact_id: optionalText(200),
  mini_crm_lead_id: optionalText(100),
}).passthrough();

export async function POST(request: NextRequest) {
  const prepared = await prepareGhlWebhookRequest(request);
  if (!prepared.ok) return prepared.response;
  const { raw, requestId } = prepared;

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return ghlWebhookJson({ error: "Invalid opportunity webhook payload." }, 422, requestId);
  const payload = parsed.data;
  const verified = verifyGhlWebhookLocation(payload.location_id);
  if (!verified.ok) return ghlWebhookJson({ error: verified.message }, verified.status, requestId);

  try {
    const result = await relayGhlOpportunity({
      ghlEventId: payload.ghl_event_id,
      locationId: payload.location_id,
      eventType: payload.event_type,
      ghlOpportunityId: payload.ghl_opportunity_id,
      ghlContactId: payload.ghl_contact_id,
      miniCrmLeadId: payload.mini_crm_lead_id,
      rawPayload: raw as Prisma.InputJsonValue,
      ipAddress: requestIp(request),
    });
    if (result.duplicate) return ghlWebhookJson({ ok: true, duplicate: true }, 200, requestId);
    await finishInboundEvent(payload.ghl_event_id, "PROCESSED");
    return ghlWebhookJson({ ok: true, relayed: true, leadMatched: result.leadMatched, leadGated: result.leadGated, leadIgnored: result.leadIgnored, preservedClosedWon: result.preservedClosedWon, callbacksCancelled: result.callbacksCancelled }, 200, requestId);
  } catch (error) {
    const failure = sanitizedGhlWebhookFailure(error);
    logGhlWebhookRuntimeFailure({ source: "ghl.opportunities", requestId, refId: payload.ghl_event_id, error });
    await Promise.allSettled([
      finishInboundEvent(payload.ghl_event_id, "ERROR"),
      logIntegrationError({
        source: "ghl.opportunities",
        refId: payload.ghl_event_id,
        message: "GHL opportunity webhook processing failed.",
        payload: { requestId, ...failure },
      }),
    ]);
    return ghlWebhookJson({ error: "Opportunity webhook processing failed." }, 500, requestId);
  }
}
