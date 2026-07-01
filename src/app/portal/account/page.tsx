import { requireUser } from "@/lib/authz";

export const dynamic = "force-dynamic";

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Account security</h1>
      <p className="mt-2 text-gray-400">Review the active account connected to this portal session.</p>
      <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <dl className="space-y-5 text-sm">
          <div><dt className="text-gray-500">Email</dt><dd className="mt-1 text-gray-100">{user.email}</dd></div>
          <div><dt className="text-gray-500">Role</dt><dd className="mt-1 text-gray-100">{label(user.role)}</dd></div>
          <div><dt className="text-gray-500">Account status</dt><dd className="mt-1 text-gray-100">{label(user.status)}</dd></div>
          <div><dt className="text-gray-500">Multi-factor authentication</dt><dd className={user.mfaEnabled ? "mt-1 text-emerald-300" : "mt-1 text-amber-300"}>{user.mfaEnabled ? "Enabled" : "Not enabled"}</dd></div>
          <div><dt className="text-gray-500">Last successful login</dt><dd className="mt-1 text-gray-100">{user.lastLoginAt ? user.lastLoginAt.toLocaleString() : "Not recorded"}</dd></div>
        </dl>
      </section>
    </main>
  );
}
