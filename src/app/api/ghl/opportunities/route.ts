import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { finishInboundEvent, logIntegrationError, requestIp, verifyGhlWebhook } from "@/lib/ghl-webhook";
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
  const raw: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid opportunity webhook payload." }, { status: 422 });
  const payload = parsed.data;
  const verified = verifyGhlWebhook(request, payload.location_id);
  if (!verified.ok) return NextResponse.json({ error: verified.message }, { status: verified.status });

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
    if (result.duplicate) return NextResponse.json({ ok: true, duplicate: true });
    await finishInboundEvent(payload.ghl_event_id, "PROCESSED");
    return NextResponse.json({ ok: true, relayed: true, leadMatched: result.leadMatched, leadGated: result.leadGated });
  } catch (error) {
    await finishInboundEvent(payload.ghl_event_id, "ERROR").catch(() => undefined);
    await logIntegrationError({ source: "ghl.opportunities", refId: payload.ghl_event_id, message: error instanceof Error ? error.message : "Webhook processing failed.", payload: raw as Prisma.InputJsonValue });
    return NextResponse.json({ error: "Opportunity webhook processing failed." }, { status: 500 });
  }
}
