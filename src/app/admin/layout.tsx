import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";

const REVIEW_ROLES = ["OWNER", "SUPER_ADMIN", "SALES_MANAGER"] as const;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const actor = await requireRole(ADMIN_ROLES);

  return (
    <AdminShell
      email={actor.email}
      role={actor.role}
      canReviewApplicants={REVIEW_ROLES.includes(actor.role as (typeof REVIEW_ROLES)[number])}
    >
      {children}
    </AdminShell>
  );
}
