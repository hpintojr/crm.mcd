import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiKey } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { applicantStatusSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Internal applicant queue. This is API-only until authenticated admin sessions and
 * role-based UI are complete; every request is guarded by MCD_ADMIN_API_KEY.
 */
export async function GET(req: NextRequest) {
  const unauthorized = requireAdminApiKey(req);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const rawStatus = searchParams.get("status");
  const parsedStatus = rawStatus ? applicantStatusSchema.safeParse(rawStatus) : null;

  if (rawStatus && !parsedStatus?.success) {
    return NextResponse.json({ error: "Invalid applicant status." }, { status: 400 });
  }

  const agents = await db.agent.findMany({
    where: parsedStatus?.success
      ? { status: parsedStatus.data }
      : { status: { in: ["SUBMITTED", "PENDING_REVIEW", "NEEDS_CORRECTION"] } },
    include: {
      onboardingDocs: {
        select: {
          docType: true,
          status: true,
          completedAt: true,
        },
        orderBy: { docType: "asc" },
      },
      certifications: {
        select: {
          decision: true,
          signedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return NextResponse.json({ applicants: agents });
}
