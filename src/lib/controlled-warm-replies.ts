import "server-only";
import { db } from "@/lib/db";
import {
  controlledTestLeadSafetyMetadata,
  isControlledTestLead,
} from "@/lib/controlled-test-leads";

export const CONTROLLED_WARM_REPLY_SOURCE = "GHL_INBOUND_REPLY";
export const CONTROLLED_WARM_REPLY_SIMULATED_ACTION =
  "LEAD_CONTROLLED_TEST_WARM_REPLY_SIMULATED";
export const CONTROLLED_WARM_REPLY_PHASE = "CONTROLLED_WARM_REPLY_HARNESS_20260711";

export type SimulateControlledWarmReplyInput = {
  leadId: string;
  note: string;
  actorUserId?: string | null;
  actorRole?: string | null;
};

export async function simulateControlledWarmReply(input: SimulateControlledWarmReplyInput) {
  const lead = await db.lead.findUnique({ where: { id: input.leadId } });
  if (!lead) throw new Error("Controlled test Lead not found.");
  if (!isControlledTestLead(lead)) {
    throw new Error("Only controlled test Leads can receive a simulated inbound reply.");
  }
  if (lead.suppressed || lead.dnc) {
    throw new Error("Suppressed Leads cannot receive a simulated inbound reply.");
  }
  if (lead.ownerAgentId) {
    throw new Error("This Lead already has an owner.");
  }

  const now = new Date();
  const note = input.note.trim();

  await db.$transaction(async (tx) => {
    await tx.leadActivity.create({
      data: {
        leadId: lead.id,
        type: "NOTE_ADDED",
        occurredAt: now,
        metadata: controlledTestLeadSafetyMetadata({
          source: CONTROLLED_WARM_REPLY_SOURCE,
          phase: CONTROLLED_WARM_REPLY_PHASE,
          simulated: true,
          note,
        }),
      },
    });
    await tx.leadNote.create({
      data: {
        leadId: lead.id,
        body: `Inbound (controlled test simulation): ${note}`,
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        actorRole: input.actorRole ?? null,
        actionType: CONTROLLED_WARM_REPLY_SIMULATED_ACTION,
        entityType: "Lead",
        entityId: lead.id,
        reason: note,
        metadata: controlledTestLeadSafetyMetadata({
          phase: CONTROLLED_WARM_REPLY_PHASE,
          simulated: true,
          leadId: lead.id,
        }),
      },
    });
  });

  return { ok: true, leadId: lead.id, occurredAt: now.toISOString() };
}
