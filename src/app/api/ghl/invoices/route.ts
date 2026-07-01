import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { finishInboundEvent, logIntegrationError, recordInboundEvent, verifyGhlWebhook } from "@/lib/ghl-webhook";

const schema = z.object({ ghl_event_id: z.string().min(1), location_id: z.string().min(1) }).passthrough();

export async function POST(request: NextRequest) {
  const raw: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid webhook payload." }, { status: 422 });
  const verified = verifyGhlWebhook(request, parsed.data.location_id);
  if (!verified.ok) return NextResponse.json({ error: verified.message }, { status: verified.status });

  try {
    const event = await recordInboundEvent({
      ghlEventId: parsed.data.ghl_event_id,
      locationId: parsed.data.location_id,
      type: "invoices",
      payload: raw as Prisma.InputJsonValue,
    });
    if (!event.firstTime) return NextResponse.json({ ok: true, duplicate: true });
    await finishInboundEvent(parsed.data.ghl_event_id, "PROCESSED");
    return NextResponse.json({ ok: true, queued: true });
  } catch (error) {
    await logIntegrationError({
      source: "ghl.invoices",
      refId: parsed.data.ghl_event_id,
      message: error instanceof Error ? error.message : "Webhook processing failed.",
      payload: raw as Prisma.InputJsonValue,
    });
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
