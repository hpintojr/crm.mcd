import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import { z } from "zod";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";
import { logColdLeadCallInitiated } from "@/lib/lead-workspace";
import {
  expectedColdLeadCallFailure,
  portalJson,
  portalRequestId,
  preparePortalJson,
} from "@/lib/portal-request-boundary";

export const dynamic = "force-dynamic";

const schema = z.object({ leadId: z.string().cuid() });

export async function POST(request: NextRequest) {
  const requestId = portalRequestId(request);
  if (!features.leads) return portalJson({ ok: false, error: "Not found." }, 404, requestId);

  await requireRole(["AGENT", ...ADMIN_ROLES]);
  const prepared = await preparePortalJson(request, requestId);
  if (!prepared.ok) return prepared.response;

  const parsed = schema.safeParse(prepared.raw);
  if (!parsed.success) {
    return portalJson({ ok: false, error: "Valid leadId is required." }, 422, requestId);
  }

  try {
    await logColdLeadCallInitiated({ leadId: parsed.data.leadId });
    revalidatePath("/portal/leads");
    revalidatePath("/portal/workspace");
    return portalJson(
      { ok: true, activityLogged: true, claimCreated: false, rule: "ACTIVITY_ONLY_NO_SOFT_LOCK" },
      200,
      requestId,
    );
  } catch (error) {
    const expected = expectedColdLeadCallFailure(error);
    if (expected) return portalJson({ ok: false, error: expected.error }, expected.status, requestId);
    throw error;
  }
}
