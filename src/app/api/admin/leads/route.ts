import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { defaultWebsiteOpportunityStatus } from "@/lib/lead-taxonomy";
import { previewLeadImport } from "@/lib/lead-import-preview";
import { normalizeBusinessPhone } from "@/lib/workflow";

// Two-phase import: `commit: false` (default) only validates + previews via the
// shared taxonomy/policy engine in lead-import-preview.ts — it never writes.
// `commit: true` re-runs the same preview and then persists exactly the rows
// that came back VALID, so nothing can be committed that wasn't previewed
// against current policy (Google Maps scrape-import block, dedupe, etc.).
const requestSchema = z.object({
  leads: z.array(z.unknown()).min(1).max(250),
  commit: z.boolean().optional(),
});

type SkipReason = { rowNumber: number; company?: string; reason: string };

export async function POST(request: NextRequest) {
  if (!features.leads) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const actor = await requireRole(ADMIN_ROLES);

  const raw: unknown = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid lead import payload." }, { status: 422 });

  const preview = previewLeadImport(parsed.data.leads);

  if (!parsed.data.commit) {
    return NextResponse.json({ ok: true, committed: false, preview });
  }

  const created: string[] = [];
  const skipped: SkipReason[] = [];

  for (const entry of preview) {
    if (entry.status !== "VALID" || !entry.row || !entry.normalized) {
      skipped.push({ rowNumber: entry.rowNumber, company: entry.row?.company, reason: entry.issues[0] ?? "Row was not valid for import." });
      continue;
    }

    const { row, normalized } = entry;

    // normalizedPhone stays on the +1E.164 convention the rest of the app
    // (suppression, DNC, workflow.ts) already relies on. dedupeKey is a
    // separate, import-local identity built from lead-normalization.ts and is
    // only used to prevent re-importing the same business.
    const normalizedPhone = normalizeBusinessPhone(row.businessPhone);

    if (!row.businessPhone && !row.email) {
      skipped.push({ rowNumber: entry.rowNumber, company: row.company, reason: "Row has neither an email nor a phone number." });
      continue;
    }
    if (!row.businessPhone) {
      skipped.push({ rowNumber: entry.rowNumber, company: row.company, reason: "Business phone is required by the current Lead schema; add a phone number and re-import this row." });
      continue;
    }

    const identifiers = [normalizedPhone, normalized.email].filter(Boolean) as string[];
    const suppressed = identifiers.length
      ? await db.leadSuppression.findFirst({ where: { identifier: { in: identifiers }, active: true } })
      : null;
    if (suppressed) {
      skipped.push({ rowNumber: entry.rowNumber, company: row.company, reason: "Suppressed contact point." });
      continue;
    }

    const existing = await db.lead.findUnique({ where: { dedupeKey: normalized.dedupeKey } });
    if (existing) {
      skipped.push({ rowNumber: entry.rowNumber, company: row.company, reason: `Duplicate of existing lead ${existing.id}.` });
      continue;
    }

    const lead = await db.lead.create({
      data: {
        company: row.company,
        contactFirstName: row.contactFirstName,
        contactLastName: row.contactLastName,
        email: normalized.email,
        businessPhone: row.businessPhone,
        normalizedPhone,
        website: row.website,
        industry: row.industry,
        city: row.city,
        state: row.state,
        country: row.country,
        timezone: row.timezone,
        source: row.sourceDetail ?? row.originalSource,
        originalSource: row.originalSource,
        sourceDetail: row.sourceDetail,
        sourceRecordUrl: row.sourceRecordUrl,
        campaignName: row.campaignName,
        campaignExternalId: row.campaignExternalId,
        intakeMethod: row.intakeMethod,
        referrerName: row.referrerName,
        referrerType: row.referrerType,
        referrerLeadId: row.referrerLeadId,
        utmSource: row.utmSource,
        utmMedium: row.utmMedium,
        utmCampaign: row.utmCampaign,
        utmContent: row.utmContent,
        utmTerm: row.utmTerm,
        websiteStatus: normalized.websiteStatus,
        websiteOpportunityStatus: defaultWebsiteOpportunityStatus(normalized.websiteStatus),
        dedupeKey: normalized.dedupeKey,
        isReferral: row.originalSource === "REFERRAL",
        referralSource: row.referrerName,
        score: 0,
        lifecycle: "PENDING_REVIEW",
        pool: normalized.pool,
      },
    });

    await db.$transaction([
      db.leadActivity.create({
        data: {
          leadId: lead.id,
          type: "LEAD_CREATED",
          metadata: { originalSource: row.originalSource, intakeMethod: row.intakeMethod, sourceDetail: row.sourceDetail ?? null },
        },
      }),
      db.auditLog.create({
        data: {
          actorUserId: actor.id,
          actorRole: actor.role,
          actionType: "LEAD_IMPORTED",
          entityType: "Lead",
          entityId: lead.id,
          metadata: { originalSource: row.originalSource, intakeMethod: row.intakeMethod },
        },
      }),
    ]);

    created.push(lead.id);
  }

  return NextResponse.json({ ok: true, committed: true, preview, createdCount: created.length, createdIds: created, skipped });
}
