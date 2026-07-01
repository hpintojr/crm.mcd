import { SignOutButton } from "@/components/sign-out-button";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";

const gates = ["SALES_AGREEMENT", "NDA_IP", "W9_PAYOUT", "ACKNOWLEDGMENT"] as const;

function title(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

export default async function PortalPage() {
  const user = await requireRole(["AGENT", ...ADMIN_ROLES]);
  const agent = await db.agent.findUnique({
    where: { userId: user.id },
    include: { onboardingDocs: true },
  });
  const isAdmin = ADMIN_ROLES.includes(user.role);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Partner portal</h1>
          <p className="mt-2 text-gray-400">Signed in as {user.email}.</p>
        </div>
        <div className="flex gap-3">
          {isAdmin && <a className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-300" href="/admin">Admin review</a>}
          <SignOutButton />
        </div>
      </div>

      {!agent ? (
        <section className="mt-10 rounded-2xl border border-ink-700 bg-ink-900 p-6 text-gray-400">
          This account is not attached to an agent profile. Use the Admin review area to manage applications and integrations.
        </section>
      ) : (
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-ink-700 bg-ink-900 p-6">
            <h2 className="font-semibold text-white">Onboarding status</h2>
            <div className="mt-5 space-y-3">
              {gates.map((gate) => {
                const document = agent.onboardingDocs.find((item) => item.docType === gate);
                const complete = document?.status === "COMPLETED";
                return (
                  <div className="flex items-center justify-between rounded-lg border border-ink-700 bg-ink-950 px-4 py-3" key={gate}>
                    <span className="text-sm text-gray-200">{title(gate)}</span>
                    <span className={complete ? "text-xs text-emerald-300" : "text-xs text-amber-300"}>{complete ? "Complete" : title(document?.status ?? "PENDING")}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-2xl border border-ink-700 bg-ink-900 p-6">
              <h2 className="font-semibold text-white">Profile</h2>
              <p className="mt-4 text-sm text-gray-400">{agent.preferredName || agent.legalName}</p>
              <p className="mt-1 text-sm text-gray-400">{agent.personalEmail}</p>
              <p className="mt-1 text-sm text-gray-400">{agent.mobile}</p>
            </section>
            <section className="rounded-2xl border border-ink-700 bg-ink-900 p-6">
              <h2 className="font-semibold text-white">Lead access</h2>
              <p className="mt-2 text-sm text-gray-400">{agent.canClaimLeads ? "Lead access is active." : "Lead access remains locked until manager certification is complete."}</p>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
