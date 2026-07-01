import { notFound } from "next/navigation";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({ searchParams }: { searchParams: Promise<{ leadId?: string }> }) {
  if (!features.leads) notFound();
  const { leadId } = await searchParams;
  if (!leadId) notFound();
  const user = await requireRole(["AGENT", ...ADMIN_ROLES]);
  const agent = await db.agent.findUnique({ where: { userId: user.id } });
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  const isAdmin = ADMIN_ROLES.includes(user.role);
  if (!lead || (!isAdmin && (!agent || lead.ownerAgentId !== agent.id))) notFound();
  return <main className="mx-auto min-h-screen max-w-6xl px-6 py-12 text-white">{lead.company}</main>;
}
