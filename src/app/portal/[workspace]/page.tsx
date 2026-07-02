import { notFound } from "next/navigation";
import { PortalFeaturePage } from "@/components/portal-feature-page";
import { db } from "@/lib/db";
import { getPortalContext } from "@/lib/portal-context";

const pages = {
  proposals: { eyebrow: "Sales workflow", title: "Proposals", description: "Sent proposals and status will appear here.", state: "Proposal workspace is planned" },
} as const;

type PageProps = { params: Promise<{ workspace: string }> };

function title(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function formatAppointment(value: Date) {
  return value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" });
}

export default async function WorkspacePage({ params }: PageProps) {
  const { workspace } = await params;
  const { user, agent, isAdmin } = await getPortalContext();

  if (workspace === "schedule") {
    const appointments = await db.appointment.findMany({
      where: isAdmin ? undefined : agent ? { agentId: agent.id } : { id: "__none__" },
      orderBy: { startAt: "asc" },
      take: 50,
    });

    return (
      <PortalFeaturePage eyebrow="Appointments" title="Schedule" description="Your booked demos and relevant appointments appear here after GHL relays them to your workspace.">
        <section className="portal-card max-w-4xl">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div><h2 className="portal-heading text-lg font-semibold">Upcoming and recent appointments</h2><p className="portal-copy mt-1 text-sm">Schedule is read-only during this phase. Booking, edits, cancellations, and guest invitations stay in GHL and the connected calendar.</p></div>
            {isAdmin && <span className="portal-status-good text-sm font-semibold">Company view</span>}
          </div>
          {appointments.length === 0 ? (
            <div className="portal-callout mt-5 text-sm"><span className="font-medium portal-heading">No synced appointments yet.</span><p className="portal-copy mt-1">The page will populate after the GHL appointment relay workflow is published and sends its first event.</p></div>
          ) : (
            <div className="mt-5 divide-y portal-border">
              {appointments.map((appointment) => (
                <article className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between" key={appointment.id}>
                  <div><p className="portal-heading font-medium">{appointment.title}</p><p className="portal-copy mt-1 text-sm">{formatAppointment(appointment.startAt)} PT{appointment.endAt ? ` – ${formatAppointment(appointment.endAt).split(", ")[1]}` : ""}</p><p className="portal-copy mt-1 text-xs">{appointment.calendarName || "Mercury Call Desk calendar"} · {title(appointment.status)}</p></div>
                  {appointment.meetingUrl && <a className="portal-action-link" href={appointment.meetingUrl} target="_blank" rel="noreferrer">Join meeting</a>}
                </article>
              ))}
            </div>
          )}
        </section>
      </PortalFeaturePage>
    );
  }

  if (workspace === "training") {
    const certification = agent?.certifications[0];
    return (
      <PortalFeaturePage eyebrow="Readiness" title="Training" description="Track your path from completed onboarding to manager-approved lead access.">
        <section className="grid max-w-4xl gap-5 md:grid-cols-2">
          <div className="portal-card"><p className="portal-subheading text-xs font-medium uppercase tracking-wide">Certification</p><p className="portal-heading mt-2 text-xl font-semibold">{certification ? title(certification.decision) : "Pending manager review"}</p><p className="portal-copy mt-2 text-sm">Complete required training and any manager-requested practice before certification.</p></div>
          <div className="portal-card"><p className="portal-subheading text-xs font-medium uppercase tracking-wide">Lead access</p><p className={`mt-2 text-xl font-semibold ${agent?.canClaimLeads ? "portal-status-good" : "portal-status-pending"}`}>{agent?.canClaimLeads ? "Enabled" : "Locked"}</p><p className="portal-copy mt-2 text-sm">Manager certification controls lead eligibility.</p></div>
        </section>
        <section className="portal-card max-w-4xl"><h2 className="portal-heading text-lg font-semibold">Training library</h2><p className="portal-copy mt-3 text-sm">Product training, scripts, demo expectations, and role-play material will be published here as the program is finalized.</p></section>
      </PortalFeaturePage>
    );
  }

  if (workspace === "resources") {
    const resources = ["Sales Partner Agreement", "NDA / Confidentiality and IP Agreement", "New Hire Acknowledgment", "Sales scripts and product guides", "Compliance and brand guidance"];
    return <PortalFeaturePage eyebrow="Reference" title="Resources" description="Approved materials for your Mercury Call Desk partner role will be organized here."><section className="portal-card max-w-4xl"><h2 className="portal-heading text-lg font-semibold">Available resource categories</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{resources.map((resource) => <div className="portal-callout text-sm" key={resource}>{resource}</div>)}</div><p className="portal-copy mt-5 text-sm">Personal tax information and bank details are intentionally not displayed in this library.</p></section></PortalFeaturePage>;
  }

  if (workspace === "settings") {
    return <PortalFeaturePage eyebrow="Account" title="Settings" description="Review your account and workspace preferences."><section className="grid max-w-4xl gap-5 md:grid-cols-2"><div className="portal-card"><h2 className="portal-heading text-lg font-semibold">Profile</h2><dl className="mt-4 space-y-3 text-sm"><div><dt className="portal-subheading">Legal name</dt><dd className="portal-heading mt-1">{agent?.legalName || "Not linked"}</dd></div><div><dt className="portal-subheading">Email</dt><dd className="portal-heading mt-1">{user.email}</dd></div><div><dt className="portal-subheading">Mobile</dt><dd className="portal-heading mt-1">{agent?.mobile || "Not linked"}</dd></div></dl></div><div className="portal-card"><h2 className="portal-heading text-lg font-semibold">Security</h2><p className="portal-copy mt-3 text-sm">Account status: {title(user.status)}.</p><p className="portal-copy mt-3 text-sm">Multi-factor authentication: {user.mfaEnabled ? "enabled" : "not enabled"}.</p><p className="portal-copy mt-3 text-sm">Use the sidebar to choose your light or dark workspace preference.</p></div></section></PortalFeaturePage>;
  }

  const page = pages[workspace as keyof typeof pages];
  if (!page) notFound();
  return <PortalFeaturePage eyebrow={page.eyebrow} title={page.title} description={page.description}><section className="portal-card max-w-3xl"><h2 className="portal-heading text-lg font-semibold">{page.state}</h2><p className="portal-copy mt-3 text-sm">This workspace is visible now so partners know where each operating function will live. Its controlled data connection will be enabled only after the relevant workflow is ready.</p></section></PortalFeaturePage>;
}
