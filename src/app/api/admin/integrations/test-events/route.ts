import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";
import {
  applyControlledGhlTestEvent,
  controlledAppointmentEventTypes,
  controlledOpportunityEventTypes,
  previewControlledGhlTestEvent,
  type ControlledGhlTestEventType,
} from "@/lib/controlled-ghl-test-events";

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
  if (!features.leads) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const actor = await requireRole(ADMIN_ROLES);
  const raw: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid controlled test event request." }, { status: 422 });

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
    return NextResponse.json(
      {
        ok: true,
        reportType: "controlled-ghl-test-event",
        mode: parsed.data.mode,
        generatedAt: new Date().toISOString(),
        generatedByRole: actor.role,
        result,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Controlled GHL test event failed." }, { status: 400 });
  }
}
