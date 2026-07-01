import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SignOutButton } from "@/components/sign-out-button";
import { requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { addContactTag } from "@/lib/ghl";

const REVIEW_ROLES = ["OWNER", "SUPER_ADMIN", "SALES_MANAGER"] as const;
const actionSchema = z.object({
  agentId: z.string().cuid(),
  action: z.enum(["confirm_call", "approve", "needs_correction", "reject"]),
  note: z.string().trim().max(2_000).optional(),
});

function statusLabel(status: string) {
  return status.replaceAll("_", " ").toLowerCase().replace(/^./, (value) => value.toUpperCase());
}

export default async function AdminPage() {
  const user = await requireRole([...REVIEW_ROLES]);
  const applicants = await db.agent.findMany({
    where: { status: { in: ["SUBMITTED", "PENDING_REVIEW", "NEEDS_CORRECTION", "APPROVED"] } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      legalName: true,
      preferredName: true,
      personalEmail: true,
      mobile: true,
      status: true,
      createdAt: true,
      confirmedCallAt: true,
      approvedAt: true,
      reviewNote: true,
      ghlContactId: true,
    },
  });

  const integrationErrors = await db.integrationError.findMany({
    where: { resolved: false },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, source: true, refId: true, message: true, createdAt: true },
  });

  async function reviewApplicant(formData: FormData) {
    "use server";

    const parsed = actionSchema.safeParse({
      agentId: formData.get("agentId"),
      action: formData.get("action"),
      note: formData.get("note") || undefined,
    });
    if (!parsed.success) throw new Error("Invalid applicant action.");

    const actor = await requireRole([...REVIEW_ROLES]);
    const headerStore = await headers();
    const ipAddress = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const agent = await db.agent.findUnique({ where: { id: parsed.data.agentId } });
    if (!agent) throw new Error("Applicant not found.");

    if (parsed.data.action === "confirm_call") {
      await db.$transaction([
        db.agent.update({ where: { id: agent.id }, data: { confirmedCallAt: new Date() } }),
        db.auditLog.create({
          data: {
            actorUserId: actor.id,
            actorRole: actor.role,
            actionType: "APPLICANT_CONFIRMED_CALL",
            entityType: "Agent",
            entityId: agent.id,
            ipAddress,
          },
        }),
      ]);
    }

    if (parsed.data.action === "approve") {
      if (!agent.confirmedCallAt) throw new Error("Confirm the applicant by call before approving.");
      const tagResult = agent.ghlContactId ? await addContactTag(agent.ghlContactId, "agent-approved") : null;

      await db.$transaction(async (tx) => {
        await tx.agent.update({
          where: { id: agent.id },
          data: {
            status: "APPROVED",
            approvedById: actor.id,
            approvedAt: new Date(),
            reviewNote: null,
          },
        });
        await tx.auditLog.create({
          data: {
            actorUserId: actor.id,
            actorRole: actor.role,
            actionType: "APPLICANT_APPROVED",
            entityType: "Agent",
            entityId: agent.id,
            ipAddress,
            metadata: {
              ghlContactLinked: Boolean(agent.ghlContactId),
              ghlTagStub: tagResult?.ok ? Boolean(tagResult.stub) : false,
            },
          },
        });
        if (tagResult && !tagResult.ok) {
          await tx.integrationError.create({
            data: {
              source: "ghl.applicant-approval",
              refId: agent.ghlContactId,
              message: tagResult.error,
              payload: { agentId: agent.id, tag: "agent-approved" },
            },
          });
        }
      });
    }

    if (parsed.data.action === "needs_correction" || parsed.data.action === "reject") {
      const note = parsed.data.note?.trim();
      if (!note || note.length < 3) throw new Error("Provide a brief note for the applicant.");
      const status = parsed.data.action === "reject" ? "REJECTED" : "NEEDS_CORRECTION";
      await db.$transaction([
        db.agent.update({ where: { id: agent.id }, data: { status, reviewNote: note } }),
        db.auditLog.create({
          data: {
            actorUserId: actor.id,
            actorRole: actor.role,
            actionType: status === "REJECTED" ? "APPLICANT_REJECTED" : "APPLICANT_CORRECTION_REQUESTED",
            entityType: "Agent",
            entityId: agent.id,
            ipAddress,
            reason: note,
          },
        }),
      ]);
    }

    revalidatePath("/admin");
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Applicant review</h1>
          <p className="mt-2 text-gray-400">Signed in as {user.email} ({user.role}). Approving starts the GHL e-sign workflow.</p>
        </div>
        <SignOutButton />
      </div>

      <section className="mt-10 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        <div className="border-b border-ink-700 px-6 py-4">
          <h2 className="font-semibold text-white">Applicant queue</h2>
          <p className="mt-1 text-sm text-gray-400">A confirmation call is required before approval.</p>
        </div>
        {applicants.length === 0 ? (
          <p className="px-6 py-10 text-sm text-gray-400">No applicants need review right now.</p>
        ) : (
          <div className="divide-y divide-ink-700">
            {applicants.map((applicant) => (
              <article className="px-6 py-5" key={applicant.id}>
                <div className="flex flex-col justify-between gap-4 lg:flex-row">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-white">{applicant.preferredName || applicant.legalName}</h3>
                      <span className="rounded-full border border-ink-700 px-2 py-0.5 text-xs text-gray-300">{statusLabel(applicant.status)}</span>
                      <span className="text-xs text-gray-500">{applicant.ghlContactId ? "GHL linked" : "GHL not linked"}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-400">{applicant.personalEmail} · {applicant.mobile}</p>
                    <p className="mt-1 text-xs text-gray-500">Submitted {applicant.createdAt.toLocaleDateString()}</p>
                    {applicant.reviewNote && <p className="mt-3 rounded-lg bg-ink-950 px-3 py-2 text-sm text-gray-300">Review note: {applicant.reviewNote}</p>}
                  </div>

                  <div className="min-w-[18rem] space-y-2">
                    <form action={reviewApplicant}>
                      <input name="agentId" type="hidden" value={applicant.id} />
                      <input name="action" type="hidden" value="confirm_call" />
                      <button className="w-full rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200 transition hover:border-brand-500" type="submit">
                        {applicant.confirmedCallAt ? "Call confirmed" : "Confirm by call"}
                      </button>
                    </form>
                    <form action={reviewApplicant}>
                      <input name="agentId" type="hidden" value={applicant.id} />
                      <input name="action" type="hidden" value="approve" />
                      <button className="w-full rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-ink-950 transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={!applicant.confirmedCallAt}>
                        Approve and trigger e-sign
                      </button>
                    </form>
                    <form action={reviewApplicant} className="grid grid-cols-[1fr_auto] gap-2">
                      <input name="agentId" type="hidden" value={applicant.id} />
                      <input className="min-w-0 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-500" name="note" placeholder="Correction note" required />
                      <button className="rounded-lg border border-amber-700 px-3 py-2 text-sm text-amber-300" name="action" value="needs_correction" type="submit">Request correction</button>
                    </form>
                    <form action={reviewApplicant} className="grid grid-cols-[1fr_auto] gap-2">
                      <input name="agentId" type="hidden" value={applicant.id} />
                      <input className="min-w-0 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-500" name="note" placeholder="Rejection reason" required />
                      <button className="rounded-lg border border-red-800 px-3 py-2 text-sm text-red-300" name="action" value="reject" type="submit">Reject</button>
                    </form>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <h2 className="font-semibold text-white">Integration attention</h2>
        {integrationErrors.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">No unresolved integration errors.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {integrationErrors.map((error) => (
              <div className="rounded-lg border border-red-900/60 bg-red-950/20 px-4 py-3" key={error.id}>
                <p className="text-sm font-medium text-red-200">{error.source}</p>
                <p className="mt-1 break-words text-sm text-gray-300">{error.message}</p>
                <p className="mt-1 text-xs text-gray-500">{error.refId || "No reference"} · {error.createdAt.toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
