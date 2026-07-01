import { SignOutButton } from "@/components/sign-out-button";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";

export default async function PortalPage() {
  const user = await requireRole(["AGENT", ...ADMIN_ROLES]);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Partner portal</h1>
          <p className="mt-2 text-gray-400">Welcome, {user.email}.</p>
        </div>
        <SignOutButton />
      </div>
      <section className="mt-10 rounded-2xl border border-ink-700 bg-ink-900 p-6 text-gray-400">
        Your portal is protected. Onboarding, profile, and payout setup arrive in the next build slices.
      </section>
    </main>
  );
}
