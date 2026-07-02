import "server-only";

import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";

export async function getPortalContext() {
  const user = await requireRole(["AGENT", ...ADMIN_ROLES]);
  const agent = await db.agent.findUnique({
    where: { userId: user.id },
    include: {
      onboardingDocs: true,
      certifications: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return { user, agent, isAdmin: ADMIN_ROLES.includes(user.role) };
}
