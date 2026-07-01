import { revalidatePath } from "next/cache";
import { UserRole, UserStatus } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { db } from "@/lib/db";

const MANAGERS = ["OWNER", "SUPER_ADMIN"] as const;
const assignableRoles = ["SUPER_ADMIN", "SALES_MANAGER", "COMPLIANCE_MANAGER", "FINANCE_MANAGER", "AGENT", "FORMER_SERVICING_AGENT", "READ_ONLY", "HOUSE_SERVICE"] as const;
const assignableStatuses = ["ACTIVE", "SUSPENDED", "DISABLED", "INVITED"] as const;

const schema = z.object({
  userId: z.string().cuid(),
  role: z.enum(assignableRoles),
  status: z.enum(assignableStatuses),
});

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const actor = await requireRole(MANAGERS);
  const users = await db.user.findMany({
    include: { agent: { select: { legalName: true, preferredName: true } } },
    orderBy: [{ role: "asc" }, { email: "asc" }],
  });

  async function saveUser(formData: FormData) {
    "use server";
    const parsed = schema.safeParse({ userId: formData.get("userId"), role: formData.get("role"), status: formData.get("status") });
    if (!parsed.success) throw new Error("Invalid user update.");
    const manager = await requireRole(MANAGERS);
    const target = await db.user.findUnique({ where: { id: parsed.data.userId } });
    if (!target) throw new Error("User not found.");
    if (target.id === manager.id) throw new Error("Use a separate owner account to change your own access.");
    if (target.role === "OWNER") throw new Error("Owner access is protected and cannot be changed here.");
    if (manager.role !== "OWNER" && target.role === "SUPER_ADMIN") throw new Error("Only the owner can manage a super administrator.");
    if (manager.role !== "OWNER" && parsed.data.role === "SUPER_ADMIN") throw new Error("Only the owner can assign super administrator access.");

    await db.$transaction([
      db.user.update({ where: { id: target.id }, data: { role: parsed.data.role as UserRole, status: parsed.data.status as UserStatus } }),
      db.auditLog.create({
        data: {
          actorUserId: manager.id,
          actorRole: manager.role,
          actionType: "USER_ACCESS_UPDATED",
          entityType: "User",
          entityId: target.id,
          metadata: { previousRole: target.role, previousStatus: target.status, role: parsed.data.role, status: parsed.data.status },
        },
      }),
    ]);
    revalidatePath("/admin/users");
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">User administration</h1>
      <p className="mt-2 text-gray-400">Access changes take effect immediately on the next protected request and are recorded in audit history.</p>
      <section className="mt-10 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        <div className="divide-y divide-ink-700">
          {users.map((user) => {
            const protectedOwner = user.role === "OWNER";
            const manageable = !protectedOwner && (actor.role === "OWNER" || user.role !== "SUPER_ADMIN");
            return (
              <article className="px-6 py-5" key={user.id}>
                <form action={saveUser} className="grid gap-4 lg:grid-cols-[1fr_12rem_12rem_auto] lg:items-end">
                  <input name="userId" type="hidden" value={user.id} />
                  <div>
                    <p className="font-medium text-white">{user.agent?.preferredName || user.agent?.legalName || user.email}</p>
                    <p className="mt-1 text-sm text-gray-400">{user.email}</p>
                    {protectedOwner && <p className="mt-2 text-xs text-brand-400">Protected owner account</p>}
                  </div>
                  <label className="text-sm text-gray-300">Role
                    <select className="mt-1 block w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-gray-100 disabled:opacity-60" defaultValue={user.role} disabled={!manageable} name="role">
                      {protectedOwner ? <option value="OWNER">Owner</option> : assignableRoles.filter((role) => actor.role === "OWNER" || role !== "SUPER_ADMIN").map((role) => <option key={role} value={role}>{label(role)}</option>)}
                    </select>
                  </label>
                  <label className="text-sm text-gray-300">Status
                    <select className="mt-1 block w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-gray-100 disabled:opacity-60" defaultValue={user.status} disabled={!manageable} name="status">
                      {protectedOwner ? <option value="ACTIVE">Active</option> : assignableStatuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}
                    </select>
                  </label>
                  <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 disabled:opacity-50" disabled={!manageable} type="submit">Save</button>
                </form>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
