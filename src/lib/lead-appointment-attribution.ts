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
  if (!features.leads) return { matched: false, gated: true };
  const lead = input.miniCrmLeadId
    ? await db.lead.findUnique({ where: { id: input.miniCrmLeadId } })
    : input.ghlContactId
      ? await db.lead.findFirst({ where: { ghlContactId: input.ghlContactId }, orderBy: { updatedAt: "desc" } })
      : null;
  if (!lead) return { matched: false, gated: false };

  const now = new Date();
  const booked = input.eventType === "APPOINTMENT_BOOKED" || input.eventType === "APPOINTMENT_CONFIRMED" || input.eventType === "APPOINTMENT_RESCHEDULED";
  const recovery = input.eventType === "APPOINTMENT_CANCELLED" || input.eventType === "APPOINTMENT_NO_SHOW";
  await db.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: lead.id },
      data: {
        lifecycle: booked ? "DEMO_BOOKED" : recovery && lead.lifecycle !== "CLOSED_WON" ? "CONTACTED" : lead.lifecycle,
        ghlContactId: input.ghlContactId ?? lead.ghlContactId,
        ghlAppointmentId: input.ghlAppointmentId,
        lastActionAt: now,
        nextActionAt: recovery ? now : lead.nextActionAt,
      },
    });
    await tx.leadActivity.create({ data: { leadId: lead.id, agentId: lead.ownerAgentId, type: booked ? "DEMO_BOOKED" : recovery ? "DISPOSITION_SET" : "CALL_COMPLETED", disposition: recovery ? "FOLLOW_UP" : undefined, metadata: { eventType: input.eventType, ghlEventId: input.ghlEventId, ghlAppointmentId: input.ghlAppointmentId, startsAt: input.startsAt?.toISOString() ?? null } } });
    if (recovery && lead.ownerAgentId) await tx.leadCallback.create({ data: { leadId: lead.id, agentId: lead.ownerAgentId, dueAt: now } });
    await tx.auditLog.create({ data: { actionType: "GHL_APPOINTMENT_ATTRIBUTED", entityType: "Lead", entityId: lead.id, metadata: { eventType: input.eventType, ghlEventId: input.ghlEventId, ghlAppointmentId: input.ghlAppointmentId } } });
  });

  return { matched: true, gated: false, leadId: lead.id };
}
