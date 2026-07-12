import Link from "next/link";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";

export default async function SettingsPage() {
  await requireRole(ADMIN_ROLES);
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Module readiness</h1>
          <p className="mt-2 max-w-3xl text-gray-400">Feature-gate values only. Open Project Readiness for deployment, acceptance, integration, and schema evidence before making any owner-gated decision.</p>
        </div>
        <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/project-readiness">Project readiness</Link>
      </div>
      <div className="mt-8 space-y-3 text-sm text-gray-300">
        <p>Lead engine: {features.leads ? "enabled" : "staged"}</p>
        <p>Commission engine: {features.commissions ? "enabled" : "staged"}</p>
        <p>Client servicing: {features.servicing ? "enabled" : "staged"}</p>
        <p>Finance operations: {features.finance ? "enabled" : "staged"}</p>
      </div>
      <section className="mt-8 rounded-2xl border border-amber-900 bg-amber-950/20 p-5 text-sm text-amber-100/80">
        This page does not change environment variables. Feature-gate changes remain an explicit owner-controlled Vercel setting action.
      </section>
    </main>
  );
}
