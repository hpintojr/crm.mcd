import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { finishInboundEvent, recordInboundEvent, requestIp, verifyGhlWebhook } from "@/lib/ghl-webhook";

const eventTypes = [
  "APPOINTMENT_BOOKED",
  "APPOINTMENT_CONFIRMED",
  "APPOINTMENT_RESCHEDULED",
  "APPOINTMENT_CANCELLED",
  "APPOINTMENT_NO_SHOW",
  "APPOINTMENT_COMPLETED",
] as const;

const optionalText = (max: number) => z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().max(max).optional(),
);

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
}).passthrough();

function appointmentStatus(eventType: z.infer<typeof payloadSchema>["event_type"]) {
  if (eventType === "APPOINTMENT_CANCELLED") return "CANCELLED";
  if (eventType === "APPOINTMENT_NO_SHOW") return "NO_SHOW";
  if (eventType === "APPOINTMENT_COMPLETED") return "COMPLETED";
  if (eventType === "APPOINTMENT_CONFIRMED") return "CONFIRMED";
  return "SCHEDULED";
}

function isTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function timeZoneOffset(instant: number, timeZone: string) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(instant)).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  return Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second)) - instant;
}

function parseDate(value: string, field: string, timeZone?: string) {
  const source = value.trim();
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(source)) {
    const date = new Date(source);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const match = source.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/);
  if (!match || !timeZone || !isTimeZone(timeZone)) {
    throw new Error(`Invalid ${field} value or appointment timezone.`);
  }

  const wallTime = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] ?? 0),
    Number((match[7] ?? "0").padEnd(3, "0")),
  );
  let instant = wallTime;
  for (let index = 0; index < 2; index += 1) instant = wallTime - timeZoneOffset(instant, timeZone);
  return new Date(instant);
}

export async function POST(request: NextRequest) {
  const raw: unknown = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid appointment webhook payload." }, { status: 422 });
  const payload = parsed.data;

  const verified = verifyGhlWebhook(request, payload.location_id);
  if (!verified.ok) return NextResponse.json({ error: verified.message }, { status: verified.status });

  try {
    const event = await recordInboundEvent({
      ghlEventId: payload.ghl_event_id,
      locationId: payload.location_id,
      type: "appointments.changed",
      payload: raw as object,
    });
    if (!event.firstTime) return NextResponse.json({ ok: true, duplicate: true });

    const agent = payload.ghl_agent_user_id
      ? await db.agent.findFirst({ where: { ghlUserId: payload.ghl_agent_user_id } })
      : null;
    const appointment = await db.appointment.upsert({
      where: { ghlAppointmentId: payload.ghl_appointment_id },
      create: {
        ghlAppointmentId: payload.ghl_appointment_id,
        ghlContactId: payload.ghl_contact_id,
        agentId: agent?.id,
        calendarId: payload.calendar_id,
        calendarName: payload.calendar_name,
        title: payload.title || "Mercury Call Desk appointment",
        startAt: parseDate(payload.starts_at, "starts_at", payload.timezone),
        endAt: payload.ends_at ? parseDate(payload.ends_at, "ends_at", payload.timezone) : null,
        timezone: payload.timezone,
        status: appointmentStatus(payload.event_type),
        meetingUrl: payload.meeting_url,
        notes: payload.notes,
      },
      update: {
        ghlContactId: payload.ghl_contact_id,
        agentId: agent?.id ?? null,
        calendarId: payload.calendar_id,
        calendarName: payload.calendar_name,
        title: payload.title || "Mercury Call Desk appointment",
        startAt: parseDate(payload.starts_at, "starts_at", payload.timezone),
        endAt: payload.ends_at ? parseDate(payload.ends_at, "ends_at", payload.timezone) : null,
        timezone: payload.timezone,
        status: appointmentStatus(payload.event_type),
        meetingUrl: payload.meeting_url,
        notes: payload.notes,
      },
    });

    await db.$transaction([
      db.auditLog.create({ data: { actionType: "GHL_APPOINTMENT_RELAYED", entityType: "Appointment", entityId: appointment.id, ipAddress: requestIp(request) } }),
      db.webhookEvent.update({ where: { ghlEventId: payload.ghl_event_id }, data: { status: "PROCESSED", processedAt: new Date() } }),
    ]);

    return NextResponse.json({ ok: true, relayed: true, appointmentId: appointment.id, agentMatched: Boolean(agent) });
  } catch (error) {
    await finishInboundEvent(payload.ghl_event_id, "ERROR").catch(() => undefined);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Appointment webhook processing failed." }, { status: 500 });
  }
}
