import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { finishInboundEvent, logIntegrationError, requestIp, verifyGhlWebhook } from "@/lib/ghl-webhook";
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
  const raw: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid inbound reply webhook payload." }, { status: 422 });
  const payload = parsed.data;
  const verified = verifyGhlWebhook(request, payload.location_id);
  if (!verified.ok) return NextResponse.json({ error: verified.message }, { status: verified.status });

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
    if (result.duplicate) return NextResponse.json({ ok: true, duplicate: true });
    await finishInboundEvent(payload.ghl_event_id, "PROCESSED");
    return NextResponse.json({ ok: true, relayed: true, leadMatched: result.leadMatched, leadGated: result.leadGated, leadIgnored: result.leadIgnored, callbackCreated: result.callbackCreated, callbackExpedited: result.callbackExpedited });
  } catch (error) {
    await finishInboundEvent(payload.ghl_event_id, "ERROR").catch(() => undefined);
    await logIntegrationError({ source: "ghl.replies", refId: payload.ghl_event_id, message: error instanceof Error ? error.message : "Inbound reply webhook processing failed.", payload: raw as Prisma.InputJsonValue });
    return NextResponse.json({ error: "Inbound reply webhook processing failed." }, { status: 500 });
  }
}
