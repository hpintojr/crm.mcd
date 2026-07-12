import { NextRequest } from "next/server";
import { z } from "zod";
import { expectedControlledGhlTestFailure } from "@/lib/admin-controlled-test-boundary";
import {
  authenticatedJson,
  authenticatedRequestId,
  prepareAuthenticatedJson,
} from "@/lib/authenticated-json-boundary";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import {
  applyControlledGhlTestEvent,
  controlledAppointmentEventTypes,
  controlledOpportunityEventTypes,
  previewControlledGhlTestEvent,
  type ControlledGhlTestEventType,
} from "@/lib/controlled-ghl-test-events";
import { features } from "@/lib/features";

export const dynamic = "force-dynamic";

const schema = z.object({
  mode: z.enum(["preview", "apply"]).default("preview"),
  leadId: z.string().cuid(),
  family: z.enum(["appointment", "opportunity"]),
  eventType: z.string().trim().min(1),
  note: z.string().trim().max(1000).optional(),
});

function normalizeEventType(family: "appointment" | "opportunity", eventType: string): ControlledGhlTestEventType {
  const normalized = eventType.trim().toUpperCase();
  if (family === "appointment" && controlledAppointmentEventTypes.includes(normalized as (typeof controlledAppointmentEventTypes)[number])) return normalized as ControlledGhlTestEventType;
  if (family === "opportunity" && controlledOpportunityEventTypes.includes(normalized as (typeof controlledOpportunityEventTypes)[number])) return normalized as ControlledGhlTestEventType;
  throw new Error("Unsupported controlled GHL test event type.");
}

export async function POST(request: NextRequest) {
  const requestId = authenticatedRequestId(request);
  if (!features.leads) return authenticatedJson({ error: "Not found." }, 404, requestId);

  const actor = await requireRole(ADMIN_ROLES);
  const prepared = await prepareAuthenticatedJson(request, requestId);
  if (!prepared.ok) return prepared.response;

  const parsed = schema.safeParse(prepared.raw);
  if (!parsed.success) {
    return authenticatedJson({ error: "Invalid controlled test event request." }, 422, requestId);
  }

  try {
    const eventType = normalizeEventType(parsed.data.family, parsed.data.eventType);
    const input = {
      leadId: parsed.data.leadId,
      family: parsed.data.family,
      eventType,
      actorUserId: actor.id,
      actorRole: actor.role,
      note: parsed.data.note,
    };
    const result = parsed.data.mode === "apply" ? await applyControlledGhlTestEvent(input) : await previewControlledGhlTestEvent(input);
    return authenticatedJson(
      {
        ok: true,
        reportType: "controlled-ghl-test-event",
        mode: parsed.data.mode,
        generatedAt: new Date().toISOString(),
        generatedByRole: actor.role,
        result,
      },
      200,
      requestId,
    );
  } catch (error) {
    const expected = expectedControlledGhlTestFailure(error);
    if (expected) return authenticatedJson({ error: expected.error }, expected.status, requestId);
    throw error;
  }
}
