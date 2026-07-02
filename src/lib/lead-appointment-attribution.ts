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
  return { matched: true, gated: false, leadId: lead.id };
}
