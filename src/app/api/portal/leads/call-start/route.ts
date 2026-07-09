import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logColdLeadCallInitiated } from "@/lib/lead-workspace";

const schema = z.object({ leadId: z.string().cuid() });

export async function POST(request: NextRequest) {
  const raw: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Valid leadId is required." }, { status: 422 });

  try {
    await logColdLeadCallInitiated({ leadId: parsed.data.leadId });
    revalidatePath("/portal/leads");
    revalidatePath("/portal/workspace");
    return NextResponse.json({ ok: true, activityLogged: true, claimCreated: false, rule: "ACTIVITY_ONLY_NO_SOFT_LOCK" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to log call activity.";
    return NextResponse.json({ ok: false, error: message }, { status: 409 });
  }
}
