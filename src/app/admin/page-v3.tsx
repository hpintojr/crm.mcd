import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AdminOnboardingStatus } from "@/components/admin-onboarding-status";
import { ResendActivationButton } from "@/components/resend-activation-button";
import { SignOutButton } from "@/components/sign-out-button";
import { requireRole } from "@/lib/authz";
import { createActivation } from "@/lib/activation";
import { db } from "@/lib/db";
import { activationEmail } from "@/lib/emails/activation-email";
import { smtpConfigured } from "@/lib/env";
import { addContactTag } from "@/lib/ghl";
import { sendMail } from "@/lib/mail";

const REVIEW_ROLES = ["OWNER", "SUPER_ADMIN", "SALES_MANAGER"] as const;
const DOC_TYPES = ["SALES_AGREEMENT", "NDA_IP", "W9_PAYOUT", "ACKNOWLEDGMENT"] as const;

const actionSchema = z.object({
  agentId: z.string().cuid(),
  action: z.enum(["confirm_call", "approve", "needs_correction", "reject", "resend_activation"]),
  note: z.string().trim().max(2000).optional(),
});

type AdminPageProps = { searchParams: Promise<{ notice?: string; recipient?: string }> };
type DocumentState = { docType: string; status: string; countersigned: boolean; completedAt: Date | null };

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function pacific(value?: Date | null) {
  if (!value) return "Not yet";
  return value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" });
}

function onboardingComplete(documents: readonly DocumentState[]) {
  const byType = new Map(documents.map((document) => [document.docType, document]));
  return DOC_TYPES.every((type) => byType.get(type)?.status === "COMPLETED") && byType.get("SALES_AGREEMENT")?.countersigned === true;
}

function noticeState(notice?: string, recipient?: string) {
  if (notice === "activation-sent" && recipient) return { success: true, message: `Activation email sent to ${recipient}. The previous unused link was invalidated.` };
  if (notice === "activation-failed") return { success: false, message: "Activation email was not sent. Review Integration attention below." };
  if (notice === "activation-unavailable") return { success: false, message: "Activation email is available only for a provisioned invited account with completed onboarding." };
  if (notice === "smtp-not-configured") return { success: false, message: "SMTP is not configured. Review Integration attention below." };
  return null;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const actor = await requireRole([...REVIEW_ROLES]);
  const params = await searchParams;
  const banner = noticeState(params.notice, params.recipient);

  const applicants = await db.agent.findMany({
    where: { status: { in: ["SUBMITTED", "PENDING_REVIEW", "NEEDS_CORRECTION", "APPROVED"] } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      legalName: true,
      companyName: true,
      preferredName: true,
      personalEmail: true,
      mobile: true,
      status: true,
      createdAt: true,
      confirmedCallAt: true,
      approvedAt: true,
      provisionedAt: true,
      reviewNote: true,
      ghlContactId: true,
      canClaimLeads: true,
      user: { select: { id: true, status: true, lastLoginAt: true, mfaEnabled: true } },
      onboardingDocs: { select: { docType: true, status: true, countersigned: true, completedAt: true } },
      certifications: { orderBy: { createdAt: "desc" }, take: 1, select: { decision: true, signedAt: true } },
    },
  });
  const errors = await db.integrationError.findMany({
    where: { resolved: false },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, source: true, refId: true, message: true, createdAt: true },
  });

  async function reviewApplicant(formData: FormData) {
    "use server";
    const parsed = actionSchema.safeParse({ agentId: formData.get("agentId"), action: formData.get("action"), note: formData.get("note") || undefined });
    if (!parsed.success) throw new Error("Invalid applicant action.");
    const reviewer = await requireRole([...REVIEW_ROLES]);
    const headersList = await headers();
    const ipAddress = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const agent = await db.agent.findUnique({
      where: { id: parsed.data.agentId },
      include: { user: { select: { id: true, email: true, status: true } }, onboardingDocs: { select: { docType: true, status: true, countersigned: true } } },
    });
    if (!agent) throw new Error("Applicant not found.");

    if (parsed.data.action === "confirm_call") {
      if (!agent.confirmedCallAt) {
        await db.$transaction([
          db.agent.update({ where: { id: agent.id }, data: { confirmedCallAt: new Date() } }),
          db.auditLog.create({ data: { actorUserId: reviewer.id, actorRole: reviewer.role, actionType: "APPLICANT_CONFIRMED_CALL", entityType: "Agent", entityId: agent.id, ipAddress } }),
        ]);
      }
      revalidatePath("/admin");
      return;
    }

    if (parsed.data.action === "approve") {
      if (agent.status === "APPROVED") {
        revalidatePath("/admin");
        return;
      }
      if (!agent.confirmedCallAt) throw new Error("Confirm the applicant by call before approving.");
      const tagResult = agent.ghlContactId ? await addContactTag(agent.ghlContactId, "agent-approved") : null;
      await db.$transaction(async (tx) => {
        await tx.agent.update({ where: { id: agent.id }, data: { status: "APPROVED", approvedById: reviewer.id, approvedAt: new Date(), reviewNote: null } });
        await tx.auditLog.create({ data: { actorUserId: reviewer.id, actorRole: reviewer.role, actionType: "APPLICANT_APPROVED", entityType: "Agent", entityId: agent.id, ipAddress, metadata: { ghlContactLinked: Boolean(agent.ghlContactId), ghlTagStub: tagResult?.ok ? Boolean(tagResult.stub) : false } } });
        if (tagResult && !tagResult.ok) {
          await tx.integrationError.create({ data: { source: "ghl.applicant-approval", refId: agent.ghlContactId, message: tagResult.error, payload: { agentId: agent.id, tag: "agent-approved" } } });
        }
      });
      revalidatePath("/admin");
      return;
    }

    if (parsed.data.action === "resend_activation") {
      if (agent.status !== "APPROVED" || !agent.user || agent.user.status !== "INVITED" || !onboardingComplete(agent.onboardingDocs.map((document) => ({ ...document, completedAt: null })))) {
        revalidatePath("/admin");
        redirect("/admin?notice=activation-unavailable");
      }
      if (!smtpConfigured) {
        await db.integrationError.create({ data: { source: "activation.email", refId: agent.user.id, message: "Activation email resend was requested, but SMTP is not configured.", payload: { agentId: agent.id, requestedBy: reviewer.id } } });
        revalidatePath("/admin");
        redirect("/admin?notice=smtp-not-configured");
      }
      const activation = await createActivation(agent.user.id);
      const message = activationEmail({ activationUrl: activation.url, expiresAt: activation.expiresAt });
      const delivery = await sendMail({ to: agent.user.email, ...message });
      if (!delivery.ok || delivery.stub) {
        await db.$transaction([
          db.auditLog.create({ data: { actorUserId: reviewer.id, actorRole: reviewer.role, actionType: "ACTIVATION_LINK_RESEND_FAILED", entityType: "User", entityId: agent.user.id, ipAddress, metadata: { agentId: agent.id } } }),
          db.integrationError.create({ data: { source: "activation.email", refId: agent.user.id, message: delivery.ok ? "SMTP transport was unavailable." : delivery.error, payload: { agentId: agent.id, requestedBy: reviewer.id } } }),
        ]);
        revalidatePath("/admin");
        redirect("/admin?notice=activation-failed");
      }
      await db.$transaction([
        db.auditLog.create({ data: { actorUserId: reviewer.id, actorRole: reviewer.role, actionType: "ACTIVATION_LINK_RESENT", entityType: "User", entityId: agent.user.id, ipAddress, metadata: { agentId: agent.id, expiresAt: activation.expiresAt.toISOString() } } }),
        db.integrationError.updateMany({ where: { source: "activation.email", refId: agent.user.id, resolved: false }, data: { resolved: true, resolvedAt: new Date(), resolvedById: reviewer.id } }),
      ]);
      revalidatePath("/admin");
      redirect(`/admin?notice=activation-sent&recipient=${encodeURIComponent(agent.user.email)}`);
    }

    if (agent.status === "APPROVED") throw new Error("Approved applicants are no longer review actions.");
    const note = parsed.data.note?.trim();
    if (!note || note.length < 3) throw new Error("Provide a brief note for the applicant.");
    const status = parsed.data.action === "reject" ? "REJECTED" : "NEEDS_CORRECTION";
    await db.$transaction([
      db.agent.update({ where: { id: agent.id }, data: { status, reviewNote: note } }),
      db.auditLog.create({ data: { actorUserId: reviewer.id, actorRole: reviewer.role, actionType: status === "REJECTED" ? "APPLICANT_REJECTED" : "APPLICANT_CORRECTION_REQUESTED", entityType: "Agent", entityId: agent.id, ipAddress, reason: note } }),
    ]);
    revalidatePath("/admin");
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">Applicant review</h1><p className="mt-2 text-gray-400">Signed in as {actor.email} ({actor.role}). Approving starts the GHL e-sign workflow.</p></div>
        <SignOutButton />
      </div>
      {banner && <div className={`mt-6 rounded-xl border px-4 py-3 text-sm ${banner.success ? "border-emerald-700/70 bg-emerald-950/30 text-emerald-200" : "border-red-800/70 bg-red-950/30 text-red-200"}`}>{banner.message}</div>}
      <section className="mt-10 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        <div className="border-b border-ink-700 px-6 py-4"><h2 className="font-semibold text-white">Applicant queue</h2><p className="mt-1 text-sm text-gray-400">A confirmation call is required before approval. Approved applicants cannot trigger e-sign a second time.</p></div>
        {applicants.length === 0 ? <p className="px-6 py-10 text-sm text-gray-400">No applicants need review right now.</p> : <div className="divide-y divide-ink-700">{applicants.map((applicant) => {
          const complete = onboardingComplete(applicant.onboardingDocs);
          const completedCount = DOC_TYPES.filter((type) => applicant.onboardingDocs.some((document) => document.docType === type && document.status === "COMPLETED")).length;
          const agreement = applicant.onboardingDocs.find((document) => document.docType === "SALES_AGREEMENT");
          const certification = applicant.certifications[0];
          const canResend = applicant.status === "APPROVED" && complete && applicant.user?.status === "INVITED";
          const account = applicant.user ? label(applicant.user.status) : "Not provisioned";
          const activation = applicant.user?.status === "ACTIVE" ? "Activation complete" : applicant.user ? "Activation pending" : "Waiting for documents";
          const approvalText = applicant.user?.status === "ACTIVE" ? "Account active" : complete ? "Approved — activation pending" : "Approved — e-sign in progress";
          return <article className="px-6 py-5" key={applicant.id}><div className="flex flex-col justify-between gap-4 lg:flex-row"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium text-white">{applicant.preferredName || applicant.legalName}</h3><span className="rounded-full border border-ink-700 px-2 py-0.5 text-xs text-gray-300">{label(applicant.status)}</span><span className="text-xs text-gray-500">{applicant.ghlContactId ? "GHL linked" : "GHL not linked"}</span></div><p className="mt-1 text-sm text-gray-400">{applicant.personalEmail} · {applicant.mobile}</p>{applicant.companyName && <p className="mt-1 text-sm text-gray-400">Company / legal entity: {applicant.companyName}</p>}<p className="mt-1 text-xs text-gray-500">Submitted {pacific(applicant.createdAt)} PT</p>{applicant.reviewNote && <p className="mt-3 rounded-lg bg-ink-950 px-3 py-2 text-sm text-gray-300">Review note: {applicant.reviewNote}</p>}<AdminOnboardingStatus items={[{ label: "Account", value: account, detail: applicant.provisionedAt ? `Provisioned ${pacific(applicant.provisionedAt)} PT` : "Waiting for all documents" },{ label: "Onboarding", value: complete ? "Complete" : `${completedCount}/4 complete`, detail: agreement?.status === "COMPLETED" && !agreement.countersigned ? "Waiting for company countersignature" : "Document-gate status" },{ label: "Activation", value: activation, detail: applicant.user?.status === "ACTIVE" ? "Credentials and MFA set" : "Activation email is available after provisioning" },{ label: "Last login", value: applicant.user?.lastLoginAt ? pacific(applicant.user.lastLoginAt) : "Never", detail: "Pacific time" },{ label: "Certification", value: certification ? label(certification.decision) : "Not certified", detail: certification?.signedAt ? `Signed ${pacific(certification.signedAt)} PT` : "Manager decision required" },{ label: "Lead access", value: applicant.canClaimLeads ? "Enabled" : "Locked", detail: applicant.canClaimLeads ? "Certification complete" : "Unlocks after certification" }]} /></div><div className="min-w-[18rem] space-y-2">{applicant.status === "APPROVED" ? <><div className="rounded-lg border border-emerald-700/70 bg-emerald-950/20 px-3 py-2 text-center text-sm font-medium text-emerald-200">{approvalText}</div><div className="rounded-lg border border-ink-700 px-3 py-2 text-center text-sm text-gray-400">{applicant.confirmedCallAt ? `Call confirmed ${pacific(applicant.confirmedCallAt)} PT` : "Call confirmation missing"}</div>{canResend && <form action={reviewApplicant}><input name="agentId" type="hidden" value={applicant.id} /><input name="action" type="hidden" value="resend_activation" /><ResendActivationButton disabled={false} label="Resend activation email" /></form>}</> : <><form action={reviewApplicant}><input name="agentId" type="hidden" value={applicant.id} /><input name="action" type="hidden" value="confirm_call" /><button className="w-full rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200 transition hover:border-brand-500" type="submit">{applicant.confirmedCallAt ? "Call confirmed" : "Confirm by call"}</button></form><form action={reviewApplicant}><input name="agentId" type="hidden" value={applicant.id} /><input name="action" type="hidden" value="approve" /><button className="w-full rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-ink-950 transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={!applicant.confirmedCallAt}>Approve and trigger e-sign</button></form><form action={reviewApplicant} className="grid grid-cols-[1fr_auto] gap-2"><input name="agentId" type="hidden" value={applicant.id} /><input className="min-w-0 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-500" name="note" placeholder="Correction note" required /><button className="rounded-lg border border-amber-700 px-3 py-2 text-sm text-amber-300" name="action" value="needs_correction" type="submit">Request correction</button></form><form action={reviewApplicant} className="grid grid-cols-[1fr_auto] gap-2"><input name="agentId" type="hidden" value={applicant.id} /><input className="min-w-0 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-500" name="note" placeholder="Rejection reason" required /><button className="rounded-lg border border-red-800 px-3 py-2 text-sm text-red-300" name="action" value="reject" type="submit">Reject</button></form></>}</div></div></article>;
        })}</div>}
      </section>
      <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6"><h2 className="font-semibold text-white">Integration attention</h2>{errors.length === 0 ? <p className="mt-2 text-sm text-gray-400">No unresolved integration errors.</p> : <div className="mt-4 space-y-3">{errors.map((error) => <div className="rounded-lg border border-red-900/60 bg-red-950/20 px-4 py-3" key={error.id}><p className="text-sm font-medium text-red-200">{error.source}</p><p className="mt-1 break-words text-sm text-gray-300">{error.message}</p><p className="mt-1 text-xs text-gray-500">{error.refId || "No reference"} · {pacific(error.createdAt)} PT</p></div>)}</div>}</section>
    </main>
  );
}
