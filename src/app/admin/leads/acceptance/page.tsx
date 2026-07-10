import { notFound, redirect } from "next/navigation";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";

export const dynamic = "force-dynamic";

export default async function LeadAcceptanceIndexPage() {
  if (!features.leads) notFound();
  await requireRole(ADMIN_ROLES);
  redirect("/admin/leads/acceptance-overview");
}
