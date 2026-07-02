import Link from "next/link";
import { getPortalContext } from "@/lib/portal-context";

const gates = ["SALES_AGREEMENT", "NDA_IP", "W9_PAYOUT", "ACKNOWLEDGMENT"] as const;

function title(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

export default async function PortalPage() {
  const { user, agent } = await getPortalContext();

  if (!agent) {
    return (
      <section className="portal-card max-w-2xl">
        <h1 className="portal-heading text-2xl font-semibold">Partner workspace</h1>
        <p className="portal-copy mt-3">This active account is not attached to an agent profile. Use Admin review to manage applications and integrations.</p>
        <Link href="/admin" className="portal-action-link mt-5 inline-block">Open Admin review</Link>
      </section>
    );
  }

  const certification = agent.certifications[0];
  const completeDocuments = gates.filter((gate) => agent.onboardingDocs.find((document) => document.docType === gate)?.status === "COMPLETED").length;
  const onboardingComplete = completeDocuments === gates.length && agent.onboardingDocs.find((document) => document.docType === "SALES_AGREEMENT")?.countersigned;
  const displayName = agent.preferredName || agent.legalName;

  return (
    <div className="space-y-7">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Partner workspace</p>
          <h1 className="portal-heading mt-2 text-3xl font-semibold">Welcome back, {displayName}</h1>
          <p className="portal-subheading mt-2">Your onboarding, readiness, and daily work will live here.</p>
        </div>
        <Link href="/portal/training" className="portal-action-link">View training status</Link>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="portal-stat"><p className="portal-subheading text-xs font-medium uppercase tracking-wide">Onboarding</p><p className="portal-heading mt-2 text-xl font-semibold">{onboardingComplete ? "Complete" : `${completeDocuments}/4 complete`}</p><p className="portal-copy mt-1 text-sm">Required documents</p></div>
        <div className="portal-stat"><p className="portal-subheading text-xs font-medium uppercase tracking-wide">Certification</p><p className="portal-heading mt-2 text-xl font-semibold">{certification ? title(certification.decision) : "Pending"}</p><p className="portal-copy mt-1 text-sm">Manager decision</p></div>
        <div className="portal-stat"><p className="portal-subheading text-xs font-medium uppercase tracking-wide">Lead access</p><p className={`mt-2 text-xl font-semibold ${agent.canClaimLeads ? "portal-status-good" : "portal-status-pending"}`}>{agent.canClaimLeads ? "Enabled" : "Locked"}</p><p className="portal-copy mt-1 text-sm">Unlocks after certification</p></div>
        <div className="portal-stat"><p className="portal-subheading text-xs font-medium uppercase tracking-wide">Account</p><p className="portal-heading mt-2 text-xl font-semibold">{title(user.status)}</p><p className="portal-copy mt-1 text-sm">Portal access is active</p></div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="portal-card">
          <div className="flex items-center justify-between gap-4"><h2 className="portal-heading text-lg font-semibold">Onboarding status</h2><Link href="/portal/resources" className="portal-action-link">Resources</Link></div>
          <div className="mt-5 space-y-3">
            {gates.map((gate) => {
              const document = agent.onboardingDocs.find((item) => item.docType === gate);
              const complete = document?.status === "COMPLETED";
              const countersignPending = gate === "SALES_AGREEMENT" && complete && !document?.countersigned;
              const state = countersignPending ? "Awaiting countersignature" : complete ? "Complete" : title(document?.status ?? "PENDING");
              return (
                <div className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3 portal-border" key={gate}>
                  <span className="text-sm font-medium portal-heading">{title(gate)}</span>
                  <span className={`text-xs font-semibold ${complete && !countersignPending ? "portal-status-good" : "portal-status-pending"}`}>{state}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <section className="portal-card">
            <h2 className="portal-heading text-lg font-semibold">Tasks</h2>
            <p className="portal-copy mt-3 text-sm">No tasks have been assigned yet. Callbacks, follow-ups, and booked-demo actions will appear here as those workflows are enabled.</p>
            <Link href="/portal/tasks" className="portal-action-link mt-4 inline-block">Open tasks</Link>
          </section>
          <section className="portal-card">
            <h2 className="portal-heading text-lg font-semibold">Schedule</h2>
            <p className="portal-copy mt-3 text-sm">Your GHL calendar and Google Meet bookings will appear here after the appointment relay is activated.</p>
            <Link href="/portal/schedule" className="portal-action-link mt-4 inline-block">Open schedule</Link>
          </section>
        </div>
      </section>
    </div>
  );
}
