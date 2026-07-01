import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { normalizeBusinessPhone } from "@/lib/workflow";

const leadSchema = z.object({
  company: z.string().trim().min(2).max(200),
  contactFirstName: z.string().trim().max(100).optional(),
  contactLastName: z.string().trim().max(100).optional(),
  email: z.string().trim().email().max(320).optional(),
  businessPhone: z.string().trim().min(7).max(50),
  website: z.string().trim().url().max(500).optional(),
  industry: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  timezone: z.string().trim().max(100).optional(),
  source: z.string().trim().max(100).optional(),
  sourceReference: z.string().trim().max(500).optional(),
  score: z.coerce.number().int().min(0).max(100).optional(),
  isReferral: z.boolean().optional(),
  referralSource: z.string().trim().max(200).optional(),
});

const importSchema = z.object({ leads: z.array(leadSchema).min(1).max(250) });

export async function POST(request: NextRequest) {
  if (!features.leads) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const actor = await requireRole(ADMIN_ROLES);
  const raw: unknown = await request.json().catch(() => null);
  const parsed = importSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid lead import payload." }, { status: 422 });

  const created: string[] = [];
  const skipped: Array<{ company: string; reason: string }> = [];
  for (const candidate of parsed.data.leads) {
    const normalizedPhone = normalizeBusinessPhone(candidate.businessPhone);
    const identifiers = [normalizedPhone, candidate.email?.toLowerCase()].filter(Boolean) as string[];
    const suppressed = identifiers.length ? await db.leadSuppression.findFirst({ where: { identifier: { in: identifiers }, active: true } }) : null;
    if (suppressed) {
      skipped.push({ company: candidate.company, reason: "Suppressed contact point." });
      continue;
    }

    const lead = await db.lead.create({
      data: {
        ...candidate,
        email: candidate.email?.toLowerCase(),
        normalizedPhone,
        score: candidate.score ?? 0,
        lifecycle: "PENDING_REVIEW",
        pool: "COLD",
        isReferral: candidate.isReferral ?? false,
      },
    });
    await db.$transaction([
      db.leadActivity.create({ data: { leadId: lead.id, type: "LEAD_CREATED", metadata: { source: candidate.source ?? "manual-import" } } }),
      db.auditLog.create({ data: { actorUserId: actor.id, actorRole: actor.role, actionType: "LEAD_IMPORTED", entityType: "Lead", entityId: lead.id } }),
    ]);
    created.push(lead.id);
  }

  return NextResponse.json({ ok: true, createdCount: created.length, createdIds: created, skipped });
}
