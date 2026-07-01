import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { finishInboundEvent, logIntegrationError, recordInboundEvent, verifyGhlWebhook } from "@/lib/ghl-webhook";

const schema = z.object({
  ghl_event_id: z.string().min(1),
  location_id: z.string().min(1),
  event_type: z.enum(["APPOINTMENT_BOOKED", "APPOINTMENT_CONFIRMED", "APPOINTMENT_RESCHEDULED", "APPOINTMENT_CANCELLED", "APPOINTMENT_NO_SHOW", "APPOINTMENT_COMPLETED"]),
  ghl_contact_id: z.string().min(1).optional(),
  ghl_appointment_id: z.string().min(1).optional(),
  starts_at: z.string().datetime().optional(),
  mini_crm_lead_id: z.string().cuid().optional(),
  mini_crm_agent_id: z.string().min(1).optional(),
}).passthrough();

export async function POST(request: NextRequest) {
  const raw: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid webhook payload." }, { status: 422 });
  const payload = parsed.data;
  const verified = verifyGhlWebhook(request, payload.location_id);
  if (!verified.ok) return NextResponse.json({ error: verified.message }, { status: verified.status });

  try {
    const event = await recordInboundEvent({ ghlEventId: payload.ghl_event_id, locationId: payload.location_id, type: "appointments", payload: raw as Prisma.InputJsonValue });
    if (!event.firstTime) return NextResponse.json({ ok: true, duplicate: true });
    if (!features.leads) {
      await finishInboundEvent(payload.ghl_event_id, "PROCESSED");
      return NextResponse.json({ ok: true, queued: true });
    }
    if (!payload.mini_crm_lead_id) {
      await logIntegrationError({ source: "ghl.appointments", refId: payload.ghl_event_id, message: "Appointment event has no Mini CRM lead id.", payload: raw as Prisma.InputJsonValue });
      await finishInboundEvent(payload.ghl_event_id, "ERROR");
      return NextResponse.json({ ok: true, unmatched: true }, { status: 202 });
    }
    const lead = await db.lead.findUnique({ where: { id: payload.mini_crm_lead_id } });
    if (!lead) {
      await logIntegrationError({ source: "ghl.appointments", refId: payload.mini_crm_lead_id, message: "Appointment event could not resolve a Mini CRM lead.", payload: raw as Prisma.InputJsonValue });
      await finishInboundEvent(payload.ghl_event_id, "ERROR");
      return NextResponse.json({ ok: true, unmatched: true }, { status: 202 });
    }
    const now = new Date();
    const demoEvent = ["APPOINTMENT_BOOKED", "APPOINTMENT_CONFIRMED", "APPOINTMENT_RESCHEDULED"].includes(payload.event_type);
    const recoveryEvent = ["APPOINTMENT_CANCELLED", "APPOINTMENT_NO_SHOW"].includes(payload.event_type);
    await db.$transaction([
      db.lead.update({
        where: { id: lead.id },
        data: {
          lifecycle: demoEvent ? "DEMO_BOOKED" : recoveryEvent && lead.lifecycle !== "CLOSED_WON" ? "CONTACTED" : lead.lifecycle,
          ghlContactId: payload.ghl_contact_id ?? lead.ghlContactId,
          ghlAppointmentId: payload.ghl_appointment_id ?? lead.ghlAppointmentId,
          lastActionAt: now,
          nextActionAt: recoveryEvent ? now : lead.nextActionAt,
        },
      }),
      db.leadActivity.create({
        data: {
          leadId: lead.id,
          agentId: lead.ownerAgentId,
          type: demoEvent ? "DEMO_BOOKED" : "DISPOSITION_SET",
          disposition: recoveryEvent ? "FOLLOW_UP" : undefined,
          metadata: { eventType: payload.event_type, ghlEventId: payload.ghl_event_id, startsAt: payload.starts_at },
        },
      }),
      db.auditLog.create({ data: { actionType: "GHL_APPOINTMENT_RELAYED", entityType: "Lead", entityId: lead.id, metadata: { eventType: payload.event_type, ghlEventId: payload.ghl_event_id } } }),
    ]);
    await finishInboundEvent(payload.ghl_event_id, "PROCESSED");
    return NextResponse.json({ ok: true, relayed: true });
  } catch (error) {
    await logIntegrationError({ source: "ghl.appointments", refId: parsed.data.ghl_event_id, message: error instanceof Error ? error.message : "Webhook processing failed.", payload: raw as Prisma.InputJsonValue });
    await finishInboundEvent(parsed.data.ghl_event_id, "ERROR").catch(() => undefined);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
