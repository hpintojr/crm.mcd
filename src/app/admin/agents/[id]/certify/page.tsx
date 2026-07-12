import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
};

const reviewSchema = z.object({
  agentId: z.string().cuid(),
  productScore: z.coerce.number().int().min(0).max(100).optional(),
  discoveryScore: z.coerce.number().int().min(0).max(100).optional(),
  crmScore: z.coerce.number().int().min(0).max(100).optional(),
  complianceScore: z.coerce.number().int().min(0).max(100).optional(),
  decision: z.enum(["APPROVED_FOR_LIVE", "APPROVED_WITH_COACHING", "NOT_YET_APPROVED"]),
  note: z.string().trim().min(3).max(2_000),
});

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function pacific(value: Date | null) {
  return value
    ? value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" })
    : "—";
}

function certificationErrorMessage(error: string | undefined) {
  if (error === "inactive") return "Activate the agent before granting Lead eligibility.";
  if (error === "documents") return "Complete all four onboarding documents before granting Lead eligibility.";
  return null;
}

export default async function AgentCertificationPage({ params, searchParams }: PageProps) {
  await requireRole(ADMIN_ROLES);
  const [{ id }, status] = await Promise.all([params, searchParams]);
  const agent = await db.agent.findUnique({
    where: { id },
    include: {
      user: { select: { status: true } },
      onboardingDocs: { orderBy: { docType: "asc" } },
      certifications: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!agent) notFound();

  const completedDocuments = agent.onboardingDocs.filter((document) => document.status === "COMPLETED").length;
  const latest = agent.certifications[0];
  const allDocumentsComplete = completedDocuments === 4;
  const approvalReady = agent.status === "ACTIVE" && allDocumentsComplete;
  const defaultDecision = approvalReady ? latest?.decision || "NOT_YET_APPROVED" : "NOT_YET_APPROVED";
  const errorMessage = certificationErrorMessage(status.error);

  async function recordReview(formData: FormData) {
    "use server";
    const actor = await requireRole(ADMIN_ROLES);
    const parsed = reviewSchema.parse({
      agentId: formData.get("agentId"),
      productScore: formData.get("productScore") || undefined,
      discoveryScore: formData.get("discoveryScore") || undefined,
      crmScore: formData.get("crmScore") || undefined,
      complianceScore: formData.get("complianceScore") || undefined,
      decision: formData.get("decision"),
      note: formData.get("note"),
    });

    const current = await db.agent.findUnique({
      where: { id: parsed.agentId },
      include: { onboardingDocs: { select: { status: true } } },
    });
    if (!current) redirect("/admin/agents?certificationError=agent-not-found");

    const approving = parsed.decision === "APPROVED_FOR_LIVE" || parsed.decision === "APPROVED_WITH_COACHING";
    const docsComplete = current.onboardingDocs.filter((document) => document.status === "COMPLETED").length === 4;
    if (approving && current.status !== "ACTIVE") {
      redirect(`/admin/agents/${current.id}/certify?error=inactive`);
    }
    if (approving && !docsComplete) {
      redirect(`/admin/agents/${current.id}/certify?error=documents`);
    }

    const now = new Date();
    await db.$transaction([
      db.certification.create({
        data: {
          agentId: current.id,
          managerId: actor.id,
          productScore: parsed.productScore,
          discoveryScore: parsed.discoveryScore,
          crmScore: parsed.crmScore,
          complianceScore: parsed.complianceScore,
          decision: parsed.decision,
          signedAt: now,
        },
      }),
      db.agent.update({
        where: { id: current.id },
        data: {
          canClaimLeads: approving,
          reviewNote: parsed.note,
          approvedById: approving ? actor.id : current.approvedById,
          approvedAt: approving ? now : current.approvedAt,
        },
      }),
      db.auditLog.create({
        data: {
          actorUserId: actor.id,
          actorRole: actor.role,
          actionType: "AGENT_CERTIFICATION_RECORDED",
          entityType: "Agent",
          entityId: current.id,
          reason: parsed.note,
          metadata: {
            decision: parsed.decision,
            canClaimLeads: approving,
            productScore: parsed.productScore ?? null,
            discoveryScore: parsed.discoveryScore ?? null,
            crmScore: parsed.crmScore ?? null,
            complianceScore: parsed.complianceScore ?? null,
          },
        },
      }),
    ]);

    revalidatePath(`/admin/agents/${current.id}/certify`);
    revalidatePath("/admin/agents");
    revalidatePath("/admin/readiness");
    revalidatePath("/admin/audit");
    redirect(`/admin/agents/${current.id}/certify?saved=1`);
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Agent certification</h1>
          <p className="mt-2 text-gray-400">Document the training decision before making an agent eligible to claim controlled Leads.</p>
        </div>
        <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/agents">Agent operations</Link>
      </div>

      {errorMessage && (
        <section className="mt-6 rounded-xl border border-amber-800 bg-amber-950/30 px-5 py-4 text-sm text-amber-100" role="alert">
          {errorMessage} No certification decision was recorded.
        </section>
      )}
      {status.saved === "1" && (
        <section className="mt-6 rounded-xl border border-emerald-800 bg-emerald-950/30 px-5 py-4 text-sm text-emerald-100" role="status">
          Certification decision recorded successfully.
        </section>
      )}

      <section className="mt-8 grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
          <p className="text-sm text-gray-400">Agent</p>
          <p className="mt-2 text-xl font-semibold text-white">{agent.preferredName || agent.legalName}</p>
          <p className="mt-2 text-sm text-gray-400">{agent.personalEmail} · {label(agent.status)}</p>
        </div>
        <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
          <p className="text-sm text-gray-400">Lead eligibility</p>
          <p className={agent.canClaimLeads ? "mt-2 text-xl font-semibold text-emerald-200" : "mt-2 text-xl font-semibold text-amber-200"}>{agent.canClaimLeads ? "Eligible" : "Not eligible"}</p>
          <p className="mt-2 text-sm text-gray-400">Lead feature gate: {features.leads ? "controlled test enabled" : "staged / locked"}</p>
        </div>
        <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
          <p className="text-sm text-gray-400">Onboarding documents</p>
          <p className={allDocumentsComplete ? "mt-2 text-xl font-semibold text-emerald-200" : "mt-2 text-xl font-semibold text-amber-200"}>{completedDocuments} / 4 complete</p>
          <p className="mt-2 text-sm text-gray-400">Only active agents with all documents complete can be approved.</p>
        </div>
      </section>

      {!approvalReady && (
        <section className="mt-6 rounded-xl border border-amber-800 bg-amber-950/20 p-5">
          <h2 className="font-semibold text-amber-100">Approval prerequisites not met</h2>
          <ul className="mt-3 space-y-2 text-sm text-amber-100/80">
            {agent.status !== "ACTIVE" && <li>Agent status must be Active. Current status: {label(agent.status)}.</li>}
            {!allDocumentsComplete && <li>All four onboarding documents must be completed. Current progress: {completedDocuments} of 4.</li>}
          </ul>
          <p className="mt-3 text-xs text-amber-200/70">A “Not yet approved” decision may still be recorded with coaching or correction notes.</p>
        </section>
      )}

      <section className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
          <h2 className="font-semibold text-white">Document status</h2>
          <div className="mt-4 space-y-3">
            {agent.onboardingDocs.length === 0 ? (
              <p className="text-sm text-gray-400">No onboarding documents are linked yet.</p>
            ) : (
              agent.onboardingDocs.map((document) => (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-ink-700 bg-ink-950 px-3 py-3 text-sm" key={document.id}>
                  <span className="text-gray-200">{label(document.docType)}</span>
                  <span className={document.status === "COMPLETED" ? "text-emerald-200" : "text-amber-200"}>{label(document.status)}</span>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
          <h2 className="font-semibold text-white">Record certification decision</h2>
          <p className="mt-2 text-sm text-gray-400">Approval makes the agent eligible only when the global Lead gate is intentionally enabled. It does not automatically expose Leads today.</p>
          <form action={recordReview} className="mt-5 grid gap-3">
            <input name="agentId" type="hidden" value={agent.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" defaultValue={latest?.productScore ?? ""} min="0" max="100" name="productScore" placeholder="Product score" type="number" />
              <input className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" defaultValue={latest?.discoveryScore ?? ""} min="0" max="100" name="discoveryScore" placeholder="Discovery score" type="number" />
              <input className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" defaultValue={latest?.crmScore ?? ""} min="0" max="100" name="crmScore" placeholder="CRM score" type="number" />
              <input className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" defaultValue={latest?.complianceScore ?? ""} min="0" max="100" name="complianceScore" placeholder="Compliance score" type="number" />
            </div>
            <select className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" defaultValue={defaultDecision} name="decision">
              <option value="NOT_YET_APPROVED">Not yet approved</option>
              <option disabled={!approvalReady} value="APPROVED_WITH_COACHING">Approved with coaching</option>
              <option disabled={!approvalReady} value="APPROVED_FOR_LIVE">Approved for live work</option>
            </select>
            <textarea className="min-h-28 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" defaultValue={agent.reviewNote || ""} name="note" placeholder="Decision evidence, coaching plan, or correction required" required />
            <button className="justify-self-start rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950" type="submit">Save certification decision</button>
          </form>
        </article>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        <div className="border-b border-ink-700 px-5 py-4"><h2 className="font-semibold text-white">Certification history</h2></div>
        {agent.certifications.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400">No certification decisions recorded.</p>
        ) : (
          <div className="divide-y divide-ink-700">
            {agent.certifications.map((certification) => (
              <div className="px-5 py-4" key={certification.id}>
                <p className="font-medium text-white">{label(certification.decision)}</p>
                <p className="mt-1 text-sm text-gray-400">Product {certification.productScore ?? "—"} · Discovery {certification.discoveryScore ?? "—"} · CRM {certification.crmScore ?? "—"} · Compliance {certification.complianceScore ?? "—"}</p>
                <p className="mt-1 text-xs text-gray-500">Signed {pacific(certification.signedAt)} · Recorded {pacific(certification.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
