import "server-only";

import { db } from "@/lib/db";
import { features } from "@/lib/features";

type AppointmentLeadEvent = {
  eventType: "APPOINTMENT_BOOKED" | "APPOINTMENT_CONFIRMED" | "APPOINTMENT_RESCHEDULED" | "APPOINTMENT_CANCELLED" | "APPOINTMENT_NO_SHOW" | "APPOINTMENT_COMPLETED";
  ghlEventId: string;
  ghlAppointmentId: string;
  ghlContactId?: string;
  miniCrmLeadId?: string;
  startsAt?: Date;
};

export async function attributeAppointmentToLead(input: AppointmentLeadEvent) {
  if (!features.leads) return { matched: false, gated: true, ignored: false, callbackCreated: false, callbackExpedited: false };
  const lead = input.miniCrmLeadId
    ? await db.lead.findUnique({ where: { id: input.miniCrmLeadId } })
    : input.ghlContactId
      ? await db.lead.findFirst({ where: { ghlContactId: input.ghlContactId }, orderBy: { updatedAt: "desc" } })
      : null;
  if (!lead) return { matched: false, gated: false, ignored: false, callbackCreated: false, callbackExpedited: false };

  if (lead.dnc || lead.suppressed) {
    await db.auditLog.create({ data: { actionType: "GHL_APPOINTMENT_IGNORED", entityType: "Lead", entityId: lead.id, reason: "Suppressed Lead was not changed by a GHL appointment event.", metadata: { eventType: input.eventType, ghlEventId: input.ghlEventId, ghlAppointmentId: input.ghlAppointmentId } } });
    return { matched: true, gated: false, ignored: true, callbackCreated: false, callbackExpedited: false, leadId: lead.id };
  }

  const now = new Date();
  const booked = input.eventType === "APPOINTMENT_BOOKED" || input.eventType === "APPOINTMENT_CONFIRMED" || input.eventType === "APPOINTMENT_RESCHEDULED";
  const recovery = input.eventType === "APPOINTMENT_CANCELLED" || input.eventType === "APPOINTMENT_NO_SHOW";
  const preserveClosedWon = recovery && lead.lifecycle === "CLOSED_WON";
  const existingCallback = recovery && lead.ownerAgentId ? await db.leadCallback.findFirst({ where: { leadId: lead.id, agentId: lead.ownerAgentId, status: "SCHEDULED" }, orderBy: { dueAt: "asc" } }) : null;
  const callbackCreated = Boolean(recovery && lead.ownerAgentId && !existingCallback && !preserveClosedWon);
  const callbackExpedited = Boolean(recovery && existingCallback && existingCallback.dueAt > now && !preserveClosedWon);

  await db.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: lead.id },
      data: {
        lifecycle: booked ? "DEMO_BOOKED" : recovery && !preserveClosedWon ? "CONTACTED" : lead.lifecycle,
        ghlContactId: input.ghlContactId ?? lead.ghlContactId,
        ghlAppointmentId: input.ghlAppointmentId,
        twoWayContactAt: booked ? lead.twoWayContactAt ?? now : lead.twoWayContactAt,
        lastActionAt: now,
        nextActionAt: recovery && !preserveClosedWon ? now : lead.nextActionAt,
      },
    });
    await tx.leadActivity.create({ data: { leadId: lead.id, agentId: lead.ownerAgentId, type: booked ? "DEMO_BOOKED" : recovery ? "DISPOSITION_SET" : "CALL_COMPLETED", disposition: recovery ? "FOLLOW_UP" : undefined, metadata: { eventType: input.eventType, ghlEventId: input.ghlEventId, ghlAppointmentId: input.ghlAppointmentId, startsAt: input.startsAt?.toISOString() ?? null, preservedClosedWon: preserveClosedWon, callbackCreated, callbackExpedited, twoWayContactRecorded: booked && !lead.twoWayContactAt } } });
    if (callbackCreated && lead.ownerAgentId) await tx.leadCallback.create({ data: { leadId: lead.id, agentId: lead.ownerAgentId, dueAt: now } });
    if (callbackExpedited && existingCallback) await tx.leadCallback.update({ where: { id: existingCallback.id }, data: { dueAt: now } });
    await tx.auditLog.create({ data: { actionType: preserveClosedWon ? "GHL_APPOINTMENT_RECOVERY_PRESERVED" : "GHL_APPOINTMENT_ATTRIBUTED", entityType: "Lead", entityId: lead.id, reason: preserveClosedWon ? "Ignored appointment recovery event because the Lead was already Closed Won." : undefined, metadata: { eventType: input.eventType, ghlEventId: input.ghlEventId, ghlAppointmentId: input.ghlAppointmentId, callbackCreated, callbackExpedited } } });
  });

  return { matched: true, gated: false, ignored: false, callbackCreated, callbackExpedited, preservedClosedWon: preserveClosedWon, leadId: lead.id };
}
