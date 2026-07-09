import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import {
  CONTROLLED_TEST_GHL_EXPORT_BLOCK,
  CONTROLLED_TEST_GHL_EXPORT_BLOCK_REASON,
  CONTROLLED_TEST_LEAD_CAMPAIGN,
  CONTROLLED_TEST_LEAD_SOURCE,
  LEAD_CONTROLLED_TEST_ARCHIVED_ACTION,
  LEAD_CONTROLLED_TEST_CREATED_ACTION,
  buildControlledTestPhone,
  controlledTestDedupeKey,
  controlledTestLeadSafetyMetadata,
  controlledTestLeadWhere,
  createControlledTestLeadReference,
  isControlledTestLead,
} from "@/lib/controlled-test-leads";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  company: z.string().trim().max(120).optional(),
  industry: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(40).optional(),
  scenario: z.string().trim().max(240).optional(),
});

const archiveSchema = z.object({
  leadId: z.string().cuid(),
});

function label(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase()) : "—";
}

function pacific(value: Date | null | undefined) {
  return value ? value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" }) : "—";
}

function cleanOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export default async function ControlledTestDataPage() {
  if (!features.leads) notFound();
  const actor = await requireRole(ADMIN_ROLES);

  const [controlledLeads, activeCount, archivedCount, createdAuditCount, archivedAuditCount] = await Promise.all([
    db.lead.findMany({ where: controlledTestLeadWhere, orderBy: { createdAt: "desc" }, take: 100 }),
    db.lead.count({ where: { ...controlledTestLeadWhere, suppressed: false, dnc: false } }),
    db.lead.count({ where: { ...controlledTestLeadWhere, suppressed: true } }),
    db.auditLog.count({ where: { actionType: LEAD_CONTROLLED_TEST_CREATED_ACTION, entityType: "Lead" } }),
    db.auditLog.count({ where: { actionType: LEAD_CONTROLLED_TEST_ARCHIVED_ACTION, entityType: "Lead" } }),
  ]);

  async function createControlledLead(formData: FormData) {
    "use server";
    if (!features.leads) throw new Error("Lead module is not enabled.");
    const creator = await requireRole(ADMIN_ROLES);
    const parsed = createSchema.safeParse({
      company: formData.get("company") || undefined,
      industry: formData.get("industry") || undefined,
      city: formData.get("city") || undefined,
      state: formData.get("state") || undefined,
      scenario: formData.get("scenario") || undefined,
    });
    if (!parsed.success) throw new Error("Controlled test Lead input is invalid.");

    const now = new Date();
    const sourceReference = createControlledTestLeadReference(now);
    const phone = buildControlledTestPhone(sourceReference);
    const scenario = cleanOptional(parsed.data.scenario);
    const company = cleanOptional(parsed.data.company) ?? `MCD Controlled Test Lead ${now.toISOString().slice(0, 16).replace("T", " ")}`;

    const lead = await db.$transaction(async (tx) => {
      const created = await tx.lead.create({
        data: {
          company,
          contactFirstName: "Controlled",
          contactLastName: "Tester",
          businessPhone: phone.businessPhone,
          normalizedPhone: phone.normalizedPhone,
          industry: cleanOptional(parsed.data.industry) ?? "Controlled QA",
          city: cleanOptional(parsed.data.city) ?? "Test City",
          state: cleanOptional(parsed.data.state) ?? "CA",
          country: "US",
          source: CONTROLLED_TEST_LEAD_SOURCE,
          sourceReference,
          originalSource: "OTHER",
          sourceDetail: `${CONTROLLED_TEST_GHL_EXPORT_BLOCK_REASON}${scenario ? ` Scenario: ${scenario}` : ""}`,
          campaignName: CONTROLLED_TEST_LEAD_CAMPAIGN,
          campaignExternalId: CONTROLLED_TEST_GHL_EXPORT_BLOCK,
          intakeMethod: "MANUAL_ENTRY",
          dedupeKey: controlledTestDedupeKey(sourceReference),
          score: 1,
          lifecycle: "AVAILABLE",
          pool: "COLD",
          lastActionAt: now,
        },
      });

      await tx.leadActivity.create({
        data: {
          leadId: created.id,
          type: "LEAD_CREATED",
          metadata: controlledTestLeadSafetyMetadata({ sourceReference, scenario: scenario ?? null }),
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: creator.id,
          actorRole: creator.role,
          actionType: LEAD_CONTROLLED_TEST_CREATED_ACTION,
          entityType: "Lead",
          entityId: created.id,
          reason: scenario ?? "Controlled test Lead created for production acceptance.",
          metadata: controlledTestLeadSafetyMetadata({ sourceReference, lifecycle: "AVAILABLE", pool: "COLD" }),
        },
      });
      return created;
    });

    revalidatePath("/admin/leads/controlled-test-data");
    revalidatePath("/portal/leads");
    revalidatePath(`/admin/leads/${lead.id}`);
  }

  async function archiveControlledLead(formData: FormData) {
    "use server";
    if (!features.leads) throw new Error("Lead module is not enabled.");
    const archivist = await requireRole(ADMIN_ROLES);
    const parsed = archiveSchema.safeParse({ leadId: formData.get("leadId") });
    if (!parsed.success) throw new Error("Controlled test Lead is required.");
    const reason = String(formData.get("reason") ?? "").trim() || "Controlled test Lead archived after acceptance use.";

    const lead = await db.lead.findUnique({ where: { id: parsed.data.leadId } });
    if (!isControlledTestLead(lead)) throw new Error("Only controlled test Leads can be archived from this page.");

    const now = new Date();
    await db.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: lead.id },
        data: {
          lifecycle: "DISQUALIFIED",
          pool: "COLD",
          ownerAgentId: null,
          claimedAt: null,
          nextActionAt: null,
          openPoolReleaseAt: null,
          suppressed: true,
          dnc: false,
          ghlContactId: null,
          ghlOpportunityId: null,
          ghlAppointmentId: null,
          lastActionAt: now,
          sourceDetail: `${CONTROLLED_TEST_GHL_EXPORT_BLOCK_REASON} Archived: ${reason}`,
        },
      });
      await tx.leadCallback.updateMany({ where: { leadId: lead.id, status: "SCHEDULED" }, data: { status: "CANCELLED" } });
      await tx.leadNote.create({ data: { leadId: lead.id, body: `Controlled test archive: ${reason}` } });
      await tx.leadActivity.create({
        data: {
          leadId: lead.id,
          type: "DISPOSITION_SET",
          metadata: controlledTestLeadSafetyMetadata({ archived: true, reason, priorLifecycle: lead.lifecycle, priorPool: lead.pool, priorOwnerAgentId: lead.ownerAgentId }),
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: archivist.id,
          actorRole: archivist.role,
          actionType: LEAD_CONTROLLED_TEST_ARCHIVED_ACTION,
          entityType: "Lead",
          entityId: lead.id,
          reason,
          metadata: controlledTestLeadSafetyMetadata({ archived: true, priorLifecycle: lead.lifecycle, priorPool: lead.pool, priorOwnerAgentId: lead.ownerAgentId }),
        },
      });
    });

    revalidatePath("/admin/leads/controlled-test-data");
    revalidatePath("/portal/leads");
    revalidatePath(`/admin/leads/${lead.id}`);
    revalidatePath("/admin/audit");
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Controlled test data</h1>
          <p className="mt-2 max-w-3xl text-gray-400">
            Create clearly marked COLD / AVAILABLE test Leads for acceptance checks without touching live customer or prospect records. GHL export is blocked by default through source and campaign markers.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/portal/leads">
            Open agent workspace
          </Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/api/admin/leads/controlled-test-data">
            JSON summary
          </Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/leads/testing">
            Acceptance board
          </Link>
        </div>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">Active controlled Leads</p><p className="mt-2 text-2xl font-semibold text-white">{activeCount}</p></div>
        <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">Archived controlled Leads</p><p className="mt-2 text-2xl font-semibold text-white">{archivedCount}</p></div>
        <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">Create audit records</p><p className="mt-2 text-2xl font-semibold text-white">{createdAuditCount}</p></div>
        <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">Archive audit records</p><p className="mt-2 text-2xl font-semibold text-white">{archivedAuditCount}</p></div>
      </section>

      <section className="mt-6 rounded-2xl border border-amber-900 bg-amber-950/20 p-5">
        <h2 className="font-semibold text-amber-100">Safety boundary</h2>
        <p className="mt-2 text-sm leading-6 text-amber-100/80">
          Controlled test Leads use synthetic 555 test phone numbers, source <span className="font-mono">{CONTROLLED_TEST_LEAD_SOURCE}</span>, campaign <span className="font-mono">{CONTROLLED_TEST_LEAD_CAMPAIGN}</span>, and campaign external ID <span className="font-mono">{CONTROLLED_TEST_GHL_EXPORT_BLOCK}</span>. This page does not activate workflows, submit imports, write GHL records, or change feature flags.
        </p>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <article className="rounded-2xl border border-ink-700 bg-ink-900 p-6">
          <h2 className="font-semibold text-white">Create controlled Lead</h2>
          <form action={createControlledLead} className="mt-4 grid gap-3">
            <label className="text-sm text-gray-300">Company label<input className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="company" placeholder="MCD Controlled Test Lead" /></label>
            <label className="text-sm text-gray-300">Scenario / acceptance purpose<textarea className="mt-1 min-h-24 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="scenario" placeholder="Example: cold lead claim gate, no-answer boundary, DNC blackout, aging dry-run." /></label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm text-gray-300">Industry<input className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="industry" placeholder="Controlled QA" /></label>
              <label className="text-sm text-gray-300">City<input className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="city" placeholder="Test City" /></label>
              <label className="text-sm text-gray-300">State<input className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="state" placeholder="CA" /></label>
            </div>
            <button className="justify-self-start rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950" type="submit">Create COLD / AVAILABLE test Lead</button>
          </form>
          <p className="mt-4 text-xs leading-5 text-gray-500">Signed in as {actor.email}. Every create/archive action writes immutable Lead activity plus admin audit evidence.</p>
        </article>

        <article className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
          <div className="border-b border-ink-700 px-6 py-4">
            <h2 className="font-semibold text-white">Controlled Lead inventory</h2>
            <p className="mt-1 text-sm text-gray-400">Use active records for acceptance, then archive them here when the scenario is complete.</p>
          </div>
          {controlledLeads.length === 0 ? (
            <p className="px-6 py-10 text-sm text-gray-400">No controlled test Leads have been created yet.</p>
          ) : (
            <div className="divide-y divide-ink-700">
              {controlledLeads.map((lead) => (
                <article className="px-6 py-5" key={lead.id}>
                  <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><Link className="font-medium text-white hover:text-brand-200" href={`/admin/leads/${lead.id}`}>{lead.company}</Link><span className={lead.suppressed ? "rounded-full border border-ink-700 px-2.5 py-1 text-xs text-gray-400" : "rounded-full border border-emerald-700 px-2.5 py-1 text-xs text-emerald-200"}>{lead.suppressed ? "Archived" : "Active"}</span></div>
                      <p className="mt-1 text-sm text-gray-400">{lead.businessPhone} · {label(lead.pool)} / {label(lead.lifecycle)} · Created {pacific(lead.createdAt)}</p>
                      <p className="mt-1 break-all text-xs text-gray-500">{lead.sourceReference}</p>
                      <p className="mt-1 text-xs text-amber-200">GHL export blocked by default · {lead.campaignExternalId}</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:min-w-80">
                      {!lead.suppressed && <Link className="rounded-lg border border-brand-500 px-3 py-2 text-center text-sm text-brand-200" href={`/portal/leads?selectedCold=${lead.id}`}>Open in agent workspace</Link>}
                      {!lead.suppressed ? (
                        <form action={archiveControlledLead} className="grid gap-2">
                          <input name="leadId" type="hidden" value={lead.id} />
                          <input className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="reason" placeholder="Archive reason" />
                          <button className="rounded-lg border border-amber-700 px-3 py-2 text-sm text-amber-200" type="submit">Archive controlled Lead</button>
                        </form>
                      ) : (
                        <p className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-500">Archived and hidden from active agent work.</p>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
