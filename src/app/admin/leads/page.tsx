import { notFound } from "next/navigation";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";

export default async function AdminLeadsPage() {
  if (!features.leads) notFound();
  await requireRole(ADMIN_ROLES);
  return <main className="mx-auto min-h-screen max-w-6xl px-6 py-12 text-white">Lead review</main>;
}
