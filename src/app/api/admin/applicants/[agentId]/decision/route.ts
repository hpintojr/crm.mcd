import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiKey } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { addSalesHqContactTags } from "@/lib/ghl";
import { ghlConfigured } from "@/lib/env";
import { applicantDecisionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ agentId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const unauthorized = requireAdminApiKey(req);
  if (unauthorized) return unauthorized;

  const { agentId } = await context.params;
  if (!agentId) return NextResponse.json({ error: "Missing applicant id." }, { status: 400 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = applicantDecisionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid decision payload.", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const agent = await db.agent.findUnique({
    where: { id: agentId },
    select: { id: true, status: true, ghlContactId: true, legalName: true },
  });
  if (!agent) return NextResponse.json({ error: "Applicant not found." }, { status: 404 });

  const { decision, reason } = parsed.data;
  const targetStatus = decision === "APPROVE" ? "APPROVED" : "REJECTED";

  if (agent.status === targetStatus) {
    return NextResponse.json({
      ok: true,
      agentId: agent.id,
      status: agent.status,
      idempotent: true,
    });
  }

  if (!['SUBMITTED', 'PENDING_REVIEW', 'NEEDS_CORRECTION'].includes(agent.status)) {
    return NextResponse.json(
      { error: `Applicant cannot be ${decision.toLowerCase()}d from ${agent.status}.` },
      { status: 409 },
    );
  }

  if (ghlConfigured && !agent.ghlContactId) {
    return NextResponse.json(
      { error: "Applicant is missing its required GHL contact link." },
      { status: 409 },
    );
  }

  // Approval starts the GHL e-sign workflow. Keep the local state unchanged if GHL fails.
  let ghl: { stub?: boolean } | null = null;
  if (agent.ghlContactId) {
    const tag = decision === "APPROVE" ? "agent-approved" : "agent-rejected";
    const result = await addSalesHqContactTags(agent.ghlContactId, [tag]);
    if (!result.ok) {
      return NextResponse.json(
        { error: "Unable to synchronize the applicant decision with GHL." },
        { status: 502 },
      );
    }
    ghl = { stub: result.stub };
  }

  await db.$transaction([
    db.agent.update({
      where: { id: agent.id },
      data: { status: targetStatus },
    }),
    db.auditLog.create({
      data: {
        actorRole: "INTERNAL_ADMIN_API",
        actionType: decision === "APPROVE" ? "AGENT_APPROVED" : "AGENT_REJECTED",
        entityType: "Agent",
        entityId: agent.id,
        reason: reason || null,
        metadata: {
          priorStatus: agent.status,
          ghl: ghl?.stub ? "stub" : agent.ghlContactId ? "linked" : "not-configured",
        },
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    agentId: agent.id,
    legalName: agent.legalName,
    status: targetStatus,
    ghl: ghl?.stub ? "stub" : agent.ghlContactId ? "linked" : "not-configured",
  });
}
