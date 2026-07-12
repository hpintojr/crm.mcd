import { NextRequest } from "next/server";
import { portalNoContent, portalRequestId } from "@/lib/portal-request-boundary";

export const dynamic = "force-dynamic";

// NextAuth's signOut event records the LOGOUT audit. This compatibility endpoint
// remains intentionally side-effect free and returns hardened response metadata.
export async function POST(request: NextRequest) {
  return portalNoContent(portalRequestId(request));
}
