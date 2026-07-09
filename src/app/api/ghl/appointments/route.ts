import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { finishInboundEvent, logIntegrationError, recordInboundEvent, requestIp, verifyGhlWebhook } from "@/lib/ghl-webhook";
import { parseGhlAppointmentDate } from "@/lib/ghl-appointment-time";
import { attributeAppointmentToLead } from "@/lib/lead-appointment-attribution";

const eventTypes = ["APPOINTMENT_BOOKED", "APPOINTMENT_CONFIRMED", "APPOINTMENT_RESCHEDULED", "APPOINTMENT_CANCELLED", "APPOINTMENT_NO_SHOW", "APPOINTMENT_COMPLETED"] as const;
const optionalText = (max: number) => z.preprocess((value) => typeof value === "string" && value.trim() === "" ? undefined : value, z.string().trim().max(max).optional());
const payloadSchema = z.object({
  ghl_event_id: z.string().trim().min(1),
  location_id: z.string().trim().min(1),
  event_type: z.enum(eventTypes),
  ghl_contact_id: optionalText(200),
  ghl_appointment_id: z.string().trim().min(1),
  starts_at: z.string().trim().min(1),
  ends_at: optionalText(200),
  title: optionalText(300),
  calendar_id: optionalText(200),
  calendar_name: optionalText(200),
  timezone: optionalText(100),
  meeting_url: optionalText(2000),
  notes: optionalText(4000),
  ghl_agent_user_id: optionalText(200),
  mini_crm_lead_id: optionalText(100),
}).passthrough();

function appointmentStatus(type: z.infer<typeof payloadSchema>["event_type"]) {
  if (type === "APPOINTMENT_CANCELLED") return "CANCELLED";
  if (type === "APPOINTMENT_NO_SHOW") return "NO_SHOW";
  if (type === "APPOINTMENT_COMPLETED") return "COMPLETED";
  if (type === "APPOINTMENT_CONFIRMED") return "CONFIRMED";
  return "SCHEDULED";
}

export async function POST(request: NextRequest) {
  const raw: unknown = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid appointment webhook payload." }, { status: 422 });
  const payload = parsed.data;
  const verified = verifyGhlWebhook(request, payload.location_id);
  if (!verified.ok) return NextResponse.json({ error: verified.message }, { status: verified.status });

  try {
    const event = await recordInboundEvent({ ghlEventId: payload.ghl_event_id, locationId: payload.location_id, type: "appointments.changed", payload: raw as object });
    if (!event.firstTime) return NextResponse.json({ ok: true, duplicate: true });
    const agent = payload.ghl_agent_user_id ? await db.agent.findFirst({ where: { ghlUserId: payload.ghl_agent_user_id } }) : null;
    const startAt = parseGhlAppointmentDate(payload.starts_at, "starts_at", payload.timezone);
    const endAt = payload.ends_at ? parseGhlAppointmentDate(payload.ends_at, "ends_at", payload.timezone) : null;
    const appointment = await db.appointment.upsert({
      where: { ghlAppointmentId: payload.ghl_appointment_id },
      create: { ghlAppointmentId: payload.ghl_appointment_id, ghlContactId: payload.ghl_contact_id, agentId: agent?.id, calendarId: payload.calendar_id, calendarName: payload.calendar_name, title: payload.title || "Mercury Call Desk appointment", startAt, endAt, timezone: payload.timezone, status: appointmentStatus(payload.event_type), meetingUrl: payload.meeting_url, notes: payload.notes },
      update: { ghlContactId: payload.ghl_contact_id, agentId: agent?.id ?? null, calendarId: payload.calendar_id, calendarName: payload.calendar_name, title: payload.title || "Mercury Call Desk appointment", startAt, endAt, timezone: payload.timezone, status: appointmentStatus(payload.event_type), meetingUrl: payload.meeting_url, notes: payload.notes },
    });
    const leadAttribution = await attributeAppointmentToLead({ eventType: payload.event_type, ghlEventId: payload.ghl_event_id, ghlAppointmentId: payload.ghl_appointment_id, ghlContactId: payload.ghl_contact_id, miniCrmLeadId: payload.mini_crm_lead_id, startsAt: startAt });
    await db.$transaction([
      db.auditLog.create({ data: { actionType: "GHL_APPOINTMENT_RELAYED", entityType: "Appointment", entityId: appointment.id, ipAddress: requestIp(request), metadata: { leadMatched: leadAttribution.matched, leadGated: leadAttribution.gated, leadIgnored: leadAttribution.ignored, callbackCreated: leadAttribution.callbackCreated, callbackExpedited: leadAttribution.callbackExpedited, preservedClosedWon: leadAttribution.preservedClosedWon } } }),
      db.webhookEvent.update({ where: { ghlEventId: payload.ghl_event_id }, data: { status: "PROCESSED", processedAt: new Date() } }),
    ]);
    return NextResponse.json({ ok: true, relayed: true, appointmentId: appointment.id, agentMatched: Boolean(agent), leadMatched: leadAttribution.matched, leadGated: leadAttribution.gated, leadIgnored: leadAttribution.ignored, callbackCreated: leadAttribution.callbackCreated, callbackExpedited: leadAttribution.callbackExpedited });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Appointment webhook processing failed.";
    await Promise.allSettled([
      finishInboundEvent(payload.ghl_event_id, "ERROR"),
      logIntegrationError({ source: "ghl.appointments", refId: payload.ghl_event_id, message }),
    ]);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
