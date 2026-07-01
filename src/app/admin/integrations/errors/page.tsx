import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";

const errorIdSchema = z.string().cuid();

export default async function IntegrationErrorsPage() {
  const user = await requireRole(ADMIN_ROLES);
  const errors = await db.integrationError.findMany({
    where: { resolved: false },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  async function resolveError(formData: FormData) {
    "use server";
    const parsed = errorIdSchema.safeParse(formData.get("errorId"));
    if (!parsed.success) throw new Error("Invalid integration error.");
    const actor = await requireRole(ADMIN_ROLES);
    const error = await db.integrationError.findUnique({ where: { id: parsed.data } });
    if (!error || error.resolved) return;

    await db.$transaction([
      db.integrationError.update({
        where: { id: error.id },
        data: { resolved: true, resolvedAt: new Date(), resolvedById: actor.id },
      }),
      db.auditLog.create({
        data: {
          actorUserId: actor.id,
          actorRole: actor.role,
          actionType: "INTEGRATION_ERROR_RESOLVED",
          entityType: "IntegrationError",
          entityId: error.id,
          metadata: { source: error.source, refId: error.refId },
        },
      }),
    ]);
    revalidatePath("/admin/integrations/errors");
    revalidatePath("/admin");
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Integration error queue</h1>
      <p className="mt-2 text-gray-400">Review unresolved GHL and delivery failures. Signed in as {user.email}.</p>

      <section className="mt-10 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        {errors.length === 0 ? (
          <p className="px-6 py-10 text-sm text-gray-400">No unresolved integration errors.</p>
        ) : (
          <div className="divide-y divide-ink-700">
            {errors.map((error) => (
              <article className="px-6 py-5" key={error.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-3xl">
                    <p className="font-medium text-white">{error.source}</p>
                    <p className="mt-2 break-words text-sm text-gray-300">{error.message}</p>
                    <p className="mt-2 text-xs text-gray-500">Reference: {error.refId ?? "None"} · {error.createdAt.toLocaleString()}</p>
                  </div>
                  <form action={resolveError}>
                    <input name="errorId" type="hidden" value={error.id} />
                    <button className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200 hover:border-brand-500" type="submit">Mark resolved</button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
