import "server-only";

import type { Lead } from "@prisma/client";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { attributeAppointmentToLead } from "@/lib/lead-appointment-attribution";
import { attributeOpportunityToLead } from "@/lib/lead-opportunity-attribution";
import { controlledTestLeadSafetyMetadata, isControlledTestLead } from "@/lib/controlled-test-leads";

export const CONTROLLED_GHL_TEST_EVENT_APPLIED_ACTION = "CONTROLLED_GHL_TEST_EVENT_APPLIED";
export const CONTROLLED_GHL_TEST_EVENT_PREVIEW_ACTION = "CONTROLLED_GHL_TEST_EVENT_PREVIEWED";
export const CONTROLLED_GHL_TEST_EVENT_ENTITY = "ControlledGhlTestEvent";
export const CONTROLLED_GHL_TEST_EVENT_PHASE = "CONTROLLED_GHL_HARNESS_20260709";

export const controlledAppointmentEventTypes = [
  "APPOINTMENT_BOOKED",
  "APPOINTMENT_CONFIRMED",
  "APPOINTMENT_RESCHEDULED",
  "APPOINTMENT_CANCELLED",
  "APPOINTMENT_NO_SHOW",
] as const;

export const controlledOpportunityEventTypes = ["OPPORTUNITY_WON", "OPPORTUNITY_LOST"] as const;

export type ControlledAppointmentEventType = (typeof controlledAppointmentEventTypes)[number];
export type ControlledOpportunityEventType = (typeof controlledOpportunityEventTypes)[number];
export type ControlledGhlTestFamily = "appointment" | "opportunity";
export type ControlledGhlTestEventType = ControlledAppointmentEventType | ControlledOpportunityEventType;

export type ControlledGhlTestInput = {
  leadId: string;
  family: ControlledGhlTestFamily;
  eventType: ControlledGhlTestEventType;
  actorUserId?: string | null;
  actorRole?: string | null;
  note?: string;
  startsAt?: Date;
};

type PreviewLead = Pick<Lead, "id" | "source" | "sourceReference" | "campaignName" | "campaignExternalId" | "sourceDetail" | "lifecycle" | "pool" | "ownerAgentId" | "twoWayContactAt" | "nextActionAt" | "dnc" | "suppressed" | "ghlContactId" | "ghlOpportunityId" | "ghlAppointmentId">;

function assertEnabled() {
  if (!features.leads) throw new Error("Lead module is not enabled.");
}

function isAppointmentEvent(eventType: ControlledGhlTestEventType): eventType is ControlledAppointmentEventType {
  return controlledAppointmentEventTypes.includes(eventType as ControlledAppointmentEventType);
}

function isOpportunityEvent(eventType: ControlledGhlTestEventType): eventType is ControlledOpportunityEventType {
  return controlledOpportunityEventTypes.includes(eventType as ControlledOpportunityEventType);
}

function assertFamilyEventMatch(family: ControlledGhlTestFamily, eventType: ControlledGhlTestEventType) {
  if (family === "appointment" && !isAppointmentEvent(eventType)) throw new Error("Choose an appointment event type for the appointment harness.");
  if (family === "opportunity" && !isOpportunityEvent(eventType)) throw new Error("Choose an opportunity event type for the opportunity harness.");
}

function nowStamp(now = new Date()) {
  return now.toISOString().replace(/\D/g, "").slice(0, 14);
}

function buildEventIds(lead: PreviewLead, eventType: ControlledGhlTestEventType, now = new Date()) {
  const suffix = `${nowStamp(now)}-${Math.random().toString(36).slice(2, 8)}`;
  const shortLead = lead.id.slice(-8);
  return {
    ghlEventId: `mcd-controlled-ghl-test:${eventType.toLowerCase()}:${shortLead}:${suffix}`,
    ghlContactId: lead.ghlContactId ?? `mcd-controlled-contact-${shortLead}`,
    ghlAppointmentId: lead.ghlAppointmentId ?? `mcd-controlled-appt-${shortLead}-${suffix}`,
    ghlOpportunityId: lead.ghlOpportunityId ?? `mcd-controlled-opp-${shortLead}-${suffix}`,
  };
}

async function loadControlledLead(leadId: string) {
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Controlled test Lead not found.");
  if (!isControlledTestLead(lead)) throw new Error("The GHL test harness only accepts controlled test Leads.");
  return lead;
}

export function previewControlledGhlTestEventFromLead(lead: PreviewLead, family: ControlledGhlTestFamily, eventType: ControlledGhlTestEventType) {
  assertFamilyEventMatch(family, eventType);
  const ignored = lead.dnc || lead.suppressed;
  const booked = family === "appointment" && ["APPOINTMENT_BOOKED", "APPOINTMENT_CONFIRMED", "APPOINTMENT_RESCHEDULED"].includes(eventType);
  const recovery = family === "appointment" && ["APPOINTMENT_CANCELLED", "APPOINTMENT_NO_SHOW"].includes(eventType);
  const won = eventType === "OPPORTUNITY_WON";
  const lost = eventType === "OPPORTUNITY_LOST";
  // Mirrors the guard in lead-appointment-attribution.ts: booking-family appointment events must
  // not reopen an already Closed Won Lead, same as recovery-family events and lost opportunities.
  const preservedClosedWon = (booked || recovery || lost) && lead.lifecycle === "CLOSED_WON";
  const callbackMayBeCreated = recovery && Boolean(lead.ownerAgentId) && !preservedClosedWon && !ignored;

  return {
    phase: CONTROLLED_GHL_TEST_EVENT_PHASE,
    family,
    eventType,
    leadId: lead.id,
    controlledTestLead: true,
    ignoredBecauseSuppressedOrDnc: ignored,
    preservedClosedWon,
    expected: {
      lifecycle: ignored
        ? lead.lifecycle
        : booked && !preservedClosedWon
          ? "DEMO_BOOKED"
          : recovery && !preservedClosedWon
            ? "CONTACTED"
            : won
              ? "CLOSED_WON"
              : lost && !preservedClosedWon
                ? "CLOSED_LOST"
                : lead.lifecycle,
      twoWayContactRecorded: booked && !lead.twoWayContactAt && !ignored,
      callbackCreatedOrExpedited: callbackMayBeCreated,
      callbacksCancelled: !ignored && (won || (lost && !preservedClosedWon)),
      ghlIdsWritten: !ignored,
      leadRemainsControlled: true,
      liveGhlWorkflowActivated: false,
      liveGhlExportSubmitted: false,
    },
  };
}

export async function previewControlledGhlTestEvent(input: ControlledGhlTestInput) {
  assertEnabled();
  assertFamilyEventMatch(input.family, input.eventType);
  const lead = await loadControlledLead(input.leadId);
  return previewControlledGhlTestEventFromLead(lead, input.family, input.eventType);
}

export async function applyControlledGhlTestEvent(input: ControlledGhlTestInput) {
  assertEnabled();
  assertFamilyEventMatch(input.family, input.eventType);
  const lead = await loadControlledLead(input.leadId);
  const preview = previewControlledGhlTestEventFromLead(lead, input.family, input.eventType);
  const eventIds = buildEventIds(lead, input.eventType);
  const startsAt = input.startsAt ?? new Date(Date.now() + 60 * 60 * 1000);

  const result = input.family === "appointment"
    ? await attributeAppointmentToLead({
      eventType: input.eventType as ControlledAppointmentEventType,
      ghlEventId: eventIds.ghlEventId,
      ghlAppointmentId: eventIds.ghlAppointmentId,
      ghlContactId: eventIds.ghlContactId,
      miniCrmLeadId: lead.id,
      startsAt,
    })
    : await attributeOpportunityToLead({
      eventType: input.eventType as ControlledOpportunityEventType,
      ghlEventId: eventIds.ghlEventId,
      ghlOpportunityId: eventIds.ghlOpportunityId,
      ghlContactId: eventIds.ghlContactId,
      miniCrmLeadId: lead.id,
    });

  await db.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole ?? null,
      actionType: CONTROLLED_GHL_TEST_EVENT_APPLIED_ACTION,
      entityType: CONTROLLED_GHL_TEST_EVENT_ENTITY,
      entityId: eventIds.ghlEventId,
      reason: input.note?.trim() || `Controlled GHL ${input.eventType} simulation applied to test Lead.`,
      metadata: controlledTestLeadSafetyMetadata({
        phase: CONTROLLED_GHL_TEST_EVENT_PHASE,
        family: input.family,
        eventType: input.eventType,
        leadId: lead.id,
        eventIds,
        preview,
        result,
        simulatedOnly: true,
        liveGhlWorkflowActivated: false,
        liveGhlExportSubmitted: false,
      }),
    },
  });

  return { ok: true, leadId: lead.id, eventIds, preview, result };
}
