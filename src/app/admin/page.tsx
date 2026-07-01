import { SignOutButton } from "@/components/sign-out-button";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";

export default async function AdminPage() {
  const user = await requireRole(ADMIN_ROLES);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Admin</h1>
          <p className="mt-2 text-gray-400">
            Logged in as {user.email} ({user.role}).
          </p>
        </div>
        <SignOutButton />
      </div>
      <section className="mt-10 rounded-2xl border border-ink-700 bg-ink-900 p-6 text-gray-400">
        Authentication and role protection are active. The applicant review workspace is the next build slice.
      </section>
    </main>
  );
}
