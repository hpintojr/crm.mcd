import Link from "next/link";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";

const REVIEW_ROLES = new Set(["OWNER", "SUPER_ADMIN", "SALES_MANAGER"]);

function roleLabel(role: string) {
  return role.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

export default async function AdminOverviewPage() {
  const actor = await requireRole(ADMIN_ROLES);
  const canReviewApplicants = REVIEW_ROLES.has(actor.role);

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Operations control</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Welcome back</h1>
        <p className="mt-2 max-w-3xl text-gray-400">
          You are signed in as {roleLabel(actor.role)}. This workspace shows only the operational areas approved for your role.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {canReviewApplicants ? (
          <Link className="rounded-2xl border border-ink-700 bg-ink-900 p-6 transition hover:border-brand-500" href="/admin/applicants">
            <p className="text-sm font-medium text-brand-400">People operations</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Applicant review</h2>
            <p className="mt-2 text-sm text-gray-400">Review partner applications, complete confirmation calls, approve qualified applicants, and monitor activation readiness.</p>
            <span className="mt-5 inline-block text-sm font-medium text-brand-300">Open applicant review →</span>
          </Link>
        ) : (
          <section className="rounded-2xl border border-ink-700 bg-ink-900 p-6">
            <p className="text-sm font-medium text-brand-400">People operations</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Applicant review</h2>
            <p className="mt-2 text-sm text-gray-400">Applicant decisions are limited to Owner, Super Admin, and Sales Manager roles.</p>
            <span className="mt-5 inline-block text-sm font-medium text-gray-500">Not assigned to your role</span>
          </section>
        )}

        <Link className="rounded-2xl border border-ink-700 bg-ink-900 p-6 transition hover:border-brand-500" href="/portal">
          <p className="text-sm font-medium text-brand-400">Partner experience</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Partner portal</h2>
          <p className="mt-2 text-sm text-gray-400">Open the agent-facing workspace to review onboarding, readiness, tasks, schedule, and future lead access behavior.</p>
          <span className="mt-5 inline-block text-sm font-medium text-brand-300">Open partner portal →</span>
        </Link>

        <section className="rounded-2xl border border-ink-700 bg-ink-900 p-6">
          <p className="text-sm font-medium text-brand-400">Release status</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Foundation protected</h2>
          <p className="mt-2 text-sm text-gray-400">Lead ownership, client servicing, commissions, and external automation remain disabled until their dedicated milestones pass Preview acceptance.</p>
          <span className="mt-5 inline-block text-sm font-medium text-gray-500">No data-changing action available</span>
        </section>
      </section>

      <section className="rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <h2 className="text-lg font-semibold text-white">Role boundaries</h2>
        <p className="mt-2 text-sm text-gray-400">Authorization is checked on the server for every protected route. Interface visibility is informational and never replaces server authorization.</p>
      </section>
    </div>
  );
}
