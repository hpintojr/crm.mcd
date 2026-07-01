import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";

export default async function SettingsPage() {
  await requireRole(ADMIN_ROLES);
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Module readiness</h1>
      <div className="mt-8 space-y-3 text-sm text-gray-300">
        <p>Lead engine: {features.leads ? "enabled" : "staged"}</p>
        <p>Commission engine: {features.commissions ? "enabled" : "staged"}</p>
        <p>Client servicing: {features.servicing ? "enabled" : "staged"}</p>
        <p>Finance operations: {features.finance ? "enabled" : "staged"}</p>
      </div>
    </main>
  );
}
