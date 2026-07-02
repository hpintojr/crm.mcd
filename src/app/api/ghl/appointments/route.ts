import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import {
  finishInboundEvent,
  logIntegrationError,
  recordInboundEvent,
  requestIp,
  verifyGhlWebhook,
} from "@/lib/ghl-webhook";

const eventTypes = [
  "APPOINTMENT_BOOKED",
  "APPOINTMENT_CONFIRMED",
  "APPOINTMENT_RESCHEDULED",
  "APPOINTMENT_CANCELLED",
  "APPOINTMENT_NO_SHOW",
  "APPOINTMENT_COMPLETED",
] as const;

const schema = z.object({
  ghl_event_id: z.string().trim().min(1),
  location_id: z.string().trim().min(1),
  event_type: z.enum(eventTypes),
  ghl_contact_id: z.string().trim().min(1).optional(),
  ghl_appointment_id: z.string().trim().min(1),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime().optional(),
  title: z.string().trim().min(1).max(300).optional(),
  calendar_id: z.string().trim().min(1).optional(),
  calendar_name: z.string().trim().max(200).optional(),
  timezone: z.string().trim().max(100).optional(),
  meeting_url: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(4000).optional(),
  mini_crm_lead_id: z.string().cuid().optional(),
  mini_crm_agent_id: z.string().cuid().optional(),
  ghl_agent_user_id: z.string().trim().min(1).optional(),
}).passthrough();

function appointmentStatus(eventType: z.infer<typeof schema>["event_type"]) {
  if (eventType === "APPOINTMENT_CANCELLED") return "CANCELLED";
  if (eventType === "APPOINTMENT_NO_SHOW") return "NO_SHOW";
  if (eventType === "APPOINTMENT_COMPLETED") return "COMPLETED";
  if (eventType === "APPOINTMENT_CONFIRMED") return "CONFIRMED";
  return "SCHEDULED";
}

export async function POST(request: NextRequest) {
  const raw: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid appointment webhook payload." }, { status: 422 });
  const payload = parsed.data;

  const verified = verifyGhlWebhook(request, payload.location_id);
  if (!verified.ok) {
    if (verified.status === 202) {
      await logIntegrationError({ source: "ghl.appointments", refId: payload.ghl_event_id, message: verified.message, payload: raw as Prisma.InputJsonValue });
    }
    return NextResponse.json({ error: verified.message }, { status: verified.status });
  }

  try {
    const event = await recordInboundEvent({
      ghlEventId: payload.ghl_event_id,
      locationId: payload.location_id,
      type: "appointments.changed",
      payload: raw as Prisma.InputJsonValue,
    });
    if (!event.firstTime) return NextResponse.json({ ok: true, duplicate: true });

    const agent = payload.mini_crm_agent_id
      ? await db.agent.findUnique({ where: { id: payload.mini_crm_agent_id } })
      : payload.ghl_agent_user_id
        ? await db.agent.findFirst({ where: { ghlUserId: payload.ghl_agent_user_id } })
        : null;
    const status = appointmentStatus(payload.event_type);

    const appointment = await db.appointment.upsert({
      where: { ghlAppointmentId: payload.ghl_appointment_id },
      create: {
        ghlAppointmentId: payload.ghl_appointment_id,
        ghlContactId: payload.ghl_contact_id,
        agentId: agent?.id ?? null,
        calendarId: payload.calendar_id,
        calendarName: payload.calendar_name,
        title: payload.title || "Mercury Call Desk appointment",
        startAt: new Date(payload.starts_at),
        endAt: payload.ends_at ? new Date(payload.ends_at) : null,
        timezone: payload.timezone,
        status,
        meetingUrl: payload.meeting_url,
        notes: payload.notes,
      },
      update: {
        ghlContactId: payload.ghl_contact_id,
        agentId: agent?.id ?? null,
        calendarId: payload.calendar_id,
        calendarName: payload.calendar_name,
        title: payload.title || "Mercury Call Desk appointment",
        startAt: new Date(payload.starts_at),
        endAt: payload.ends_at ? new Date(payload.ends_at) : null,
        timezone: payload.timezone,
        status,
        meetingUrl: payload.meeting_url,
        notes: payload.notes,
      },
    });

    const lead = features.leads && payload.mini_crm_lead_id
      ? await db.lead.findUnique({ where: { id: payload.mini_crm_lead_id } })
      : null;
    const now = new Date();
    const demoEvent = ["APPOINTMENT_BOOKED", "APPOINTMENT_CONFIRMED", "APPOINTMENT_RESCHEDULED"].includes(payload.event_type);
    const recoveryEvent = ["APPOINTMENT_CANCELLED", "APPOINTMENT_NO_SHOW"].includes(payload.event_type);

    await db.$transaction(async (tx) => {
      if (lead) {
        await tx.lead.update({
          where: { id: lead.id },
          data: {
            lifecycle: demoEvent ? "DEMO_BOOKED" : recoveryEvent && lead.lifecycle !== "CLOSED_WON" ? "CONTACTED" : lead.lifecycle,
            ghlContactId: payload.ghl_contact_id ?? lead.ghlContactId,
            ghlAppointmentId: payload.ghl_appointment_id,
            lastActionAt: now,
            nextActionAt: recoveryEvent ? now : lead.nextActionAt,
          },
        });
        await tx.leadActivity.create({
          data: {
            leadId: lead.id,
            agentId: lead.ownerAgentId,
            type: demoEvent ? "DEMO_BOOKED" : "DISPOSITION_SET",
            disposition: recoveryEvent ? "FOLLOW_UP" : undefined,
            metadata: { eventType: payload.event_type, ghlEventId: payload.ghl_event_id, startsAt: payload.starts_at },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actionType: "GHL_APPOINTMENT_RELAYED",
          entityType: "Appointment",
          entityId: appointment.id,
          ipAddress: requestIp(request),
          metadata: {
            eventType: payload.event_type,
            ghlEventId: payload.ghl_event_id,
            agentMatched: Boolean(agent),
            leadMatched: Boolean(lead),
          },
        },
      });
      await tx.webhookEvent.update({
        where: { ghlEventId: payload.ghl_event_id },
        data: { status: "PROCESSED", processedAt: new Date() },
      });
    });

    return NextResponse.json({ ok: true, relayed: true, appointmentId: appointment.id, agentMatched: Boolean(agent) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed.";
    await logIntegrationError({ source: "ghl.appointments", refId: parsed.data.ghl_event_id, message, payload: raw as Prisma.InputJsonValue });
    await finishInboundEvent(parsed.data.ghl_event_id, "ERROR").catch(() => undefined);
    return NextResponse.json({ error: "Appointment webhook processing failed." }, { status: 500 });
  }
}
