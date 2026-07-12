import "server-only";

import type { User, UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { routeTrace } from "@/lib/route-trace";

export type Role = UserRole;

export const ADMIN_ROLES: UserRole[] = [
  "OWNER",
  "SUPER_ADMIN",
  "SALES_MANAGER",
  "COMPLIANCE_MANAGER",
  "FINANCE_MANAGER",
];

export function mfaRequiredForRole(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}

async function redirectToLogin(path: string): Promise<never> {
  const { redirect } = await import("next/navigation");
  return redirect(path);
}

export async function requireUser(): Promise<User> {
  routeTrace("requireUser: auth start");
  const { auth } = await import("../auth");
  const session = await auth();
  const userId = session?.user?.id;
  routeTrace("requireUser: auth finished", { hasUserId: Boolean(userId) });
  if (!userId) return redirectToLogin("/login");

  const user = await db.user.findUnique({ where: { id: userId } });
  routeTrace("requireUser: user lookup finished", { found: Boolean(user), active: user?.status === "ACTIVE" });
  if (!user || user.status !== "ACTIVE") return redirectToLogin("/login?e=forbidden");

  return user;
}

export async function requireRole(roles: UserRole[]): Promise<User> {
  const user = await requireUser();
  routeTrace("requireRole: evaluated", { allowed: roles.includes(user.role) });
  if (!roles.includes(user.role)) return redirectToLogin("/login?e=forbidden");
  return user;
}
