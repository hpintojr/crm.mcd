import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse(null, { status: 204 });

  await db.auditLog.create({
    data: {
      actorUserId: session.user.id,
      actorRole: session.user.role,
      actionType: "LOGOUT",
      entityType: "User",
      entityId: session.user.id,
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    },
  });

  return new NextResponse(null, { status: 204 });
}
