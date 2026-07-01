import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
      <p className="mb-3 text-sm font-medium uppercase tracking-widest text-brand-400">
        Mercury Call Desk
      </p>
      <h1 className="text-4xl font-semibold text-white sm:text-5xl">Mini CRM</h1>
      <p className="mt-4 max-w-xl text-gray-400">
        Secure agent &amp; admin portals. Prospecting, onboarding, compliance, and commissions —
        with GoHighLevel wired in as a one-way backend.
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/signup"
          className="rounded-lg bg-brand-500 px-6 py-3 font-medium text-ink-950 transition hover:bg-brand-400"
        >
          Partner sign-up
        </Link>
        <span className="rounded-lg border border-ink-700 px-6 py-3 text-gray-400">
          Agent portal (coming soon)
        </span>
      </div>

      <p className="mt-16 text-xs text-gray-600">
        Charter Oaks Assets, Inc. d/b/a Mercury Call Desk · internal system
      </p>
    </main>
  );
}
