import "server-only";

import type { User, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

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

export async function requireUser(): Promise<User> {
  console.info("[route-trace] requireUser: auth start");
  const session = await auth();
  const userId = session?.user?.id;
  console.info("[route-trace] requireUser: auth finished", { hasUserId: Boolean(userId) });
  if (!userId) redirect("/login");

  const user = await db.user.findUnique({ where: { id: userId } });
  console.info("[route-trace] requireUser: user lookup finished", { found: Boolean(user), active: user?.status === "ACTIVE" });
  if (!user || user.status !== "ACTIVE") redirect("/login?e=forbidden");

  return user;
}

export async function requireRole(roles: UserRole[]): Promise<User> {
  const user = await requireUser();
  console.info("[route-trace] requireRole: evaluated", { allowed: roles.includes(user.role) });
  if (!roles.includes(user.role)) redirect("/login?e=forbidden");
  return user;
}
