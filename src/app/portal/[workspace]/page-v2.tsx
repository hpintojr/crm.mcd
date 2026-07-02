import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalFeaturePage } from "@/components/portal-feature-page";
import { ViewerTime } from "@/components/viewer-time";
import { db } from "@/lib/db";
import { getPortalContext } from "@/lib/portal-context";

const pages = {
  proposals: { eyebrow: "Sales workflow", title: "Proposals", description: "Sent proposals and status will appear here.", state: "Proposal workspace is planned" },
} as const;

const MEETING_ACTIVE_STATUSES = new Set(["SCHEDULED", "CONFIRMED"]);
const RECENT_OUTCOME_STATUSES = new Set(["COMPLETED", "CANCELLED", "NO_SHOW"]);

type PageProps = { params: Promise<{ workspace: string }> };

function title(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function outcomeMessage(status: string) {
  if (status === "COMPLETED") return "Completed appointment retained for recent activity.";
  if (status === "NO_SHOW") return "No-show retained for follow-up and audit history.";
  if (status === "CANCELLED") return "Cancelled appointment retained for recent activity.";
  return "Recent appointment activity.";
}

export default async function WorkspacePage({ params }: PageProps) {
  const { workspace } = await params;
  const { user, agent, isAdmin } = await getPortalContext();

  if (workspace === "schedule") {
    const now = new Date();
    const recentCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const alertCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const viewerFilter = isAdmin ? {} : agent ? { agentId: agent.id } : { id: "__none__" };
    const [upcomingAppointments, awaitingOutcome, recentOutcomes, recentActiveChanges] = await Promise.all([
      db.appointment.findMany({
        where: {
          ...viewerFilter,
          status: { in: [...MEETING_ACTIVE_STATUSES] },
          OR: [{ endAt: { gte: now } }, { endAt: null, startAt: { gte: now } }],
        },
        orderBy: { startAt: "asc" },
        take: 50,
      }),
      db.appointment.findMany({
        where: {
          ...viewerFilter,
          status: { in: [...MEETING_ACTIVE_STATUSES] },
          startAt: { gte: recentCutoff },
          OR: [{ endAt: { lt: now } }, { endAt: null, startAt: { lt: now } }],
        },
        orderBy: { startAt: "desc" },
        take: 20,
      }),
      db.appointment.findMany({
        where: {
          ...viewerFilter,
          status: { in: [...RECENT_OUTCOME_STATUSES] },
          updatedAt: { gte: recentCutoff },
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      db.appointment.findMany({
        where: {
          ...viewerFilter,
          status: { in: [...MEETING_ACTIVE_STATUSES] },
          updatedAt: { gte: alertCutoff },
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
    ]);
    const missedOrCancelled = recentOutcomes.filter((appointment) => appointment.status === "NO_SHOW" || appointment.status === "CANCELLED").length;

    return (
      <PortalFeaturePage eyebrow="Appointments" title="Schedule" description="Your upcoming booked demos appear here after GHL relays them to your workspace.">
        {(recentActiveChanges.length > 0 || awaitingOutcome.length > 0 || missedOrCancelled > 0) && <section className="portal-card mb-6 max-w-4xl"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="portal-heading text-lg font-semibold">Schedule alerts</h2><p className="portal-copy mt-1 text-sm">Live changes relayed from GHL. Booking and attendance updates remain managed in GHL; this workspace tells you what needs attention.</p></div>{missedOrCancelled > 0 && <Link className="portal-action-link shrink-0" href="/portal/tasks">Open follow-ups</Link>}</div><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="portal-callout text-sm"><p className="portal-heading font-medium">{recentActiveChanges.length} recent booking update{recentActiveChanges.length === 1 ? "" : "s"}</p><p className="portal-copy mt-1">Scheduled, confirmed, or rescheduled in the last 24 hours.</p></div><div className={awaitingOutcome.length ? "rounded-xl border border-amber-700/70 px-4 py-3 text-sm" : "portal-callout text-sm"}><p className="portal-heading font-medium">{awaitingOutcome.length} awaiting outcome</p><p className="portal-copy mt-1">Past appointment times still need a final GHL status.</p></div><div className={missedOrCancelled ? "rounded-xl border border-amber-700/70 px-4 py-3 text-sm" : "portal-callout text-sm"}><p className="portal-heading font-medium">{missedOrCancelled} follow-up check{missedOrCancelled === 1 ? "" : "s"}</p><p className="portal-copy mt-1">Recent no-show or cancelled appointment events.</p></div></div></section>}
        <section className="portal-card max-w-4xl">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div><h2 className="portal-heading text-lg font-semibold">Upcoming appointments</h2><p className="portal-copy mt-1 text-sm">Only active scheduled and confirmed appointments appear here. Booking, edits, cancellations, and guest invitations stay in GHL and the connected calendar.</p></div>
            {isAdmin && <span className="portal-status-good text-sm font-semibold">Company view</span>}
          </div>
          {upcomingAppointments.length === 0 ? (
            <div className="portal-callout mt-5 text-sm"><span className="font-medium portal-heading">No upcoming appointments.</span><p className="portal-copy mt-1">Completed, cancelled, and no-show appointments move out of this view automatically while their history is retained.</p></div>
          ) : (
            <div className="mt-5 divide-y portal-border">
              {upcomingAppointments.map((appointment) => (
                <article className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between" key={appointment.id}>
                  <div><p className="portal-heading font-medium">{appointment.title}</p><ViewerTime startAt={appointment.startAt.toISOString()} endAt={appointment.endAt?.toISOString() ?? null} /><p className="portal-copy mt-1 text-xs">{appointment.calendarName || "Mercury Call Desk calendar"} · {title(appointment.status)}</p></div>
                  {appointment.meetingUrl && MEETING_ACTIVE_STATUSES.has(appointment.status) && <a className="portal-action-link" href={appointment.meetingUrl} target="_blank" rel="noreferrer">Join meeting</a>}
                </article>
              ))}
            </div>
          )}
        </section>
        {awaitingOutcome.length > 0 && <section className="portal-card mt-6 max-w-4xl"><div><h2 className="portal-heading text-lg font-semibold">Appointments awaiting outcome</h2><p className="portal-copy mt-1 text-sm">These appointment times have passed, but GHL has not relayed Completed, No-show, or Cancelled yet. Confirm the attendance result in GHL; this list protects the record from disappearing silently.</p></div><div className="mt-5 divide-y portal-border">{awaitingOutcome.map((appointment) => <article className="py-4" key={appointment.id}><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="portal-heading font-medium">{appointment.title}</p><ViewerTime startAt={appointment.startAt.toISOString()} endAt={appointment.endAt?.toISOString() ?? null} /><p className="portal-copy mt-1 text-xs">{appointment.calendarName || "Mercury Call Desk calendar"} · Awaiting final status</p></div><span className="portal-status-pending text-sm font-semibold">Needs GHL outcome</span></div></article>)}</div></section>}
        {recentOutcomes.length > 0 && <section className="portal-card mt-6 max-w-4xl"><div><h2 className="portal-heading text-lg font-semibold">Recent appointment activity</h2><p className="portal-copy mt-1 text-sm">Completed, cancelled, and no-show appointments remain visible here for seven days. They are not deleted from Mercury Call Desk records.</p></div><div className="mt-5 divide-y portal-border">{recentOutcomes.map((appointment) => <article className="py-4" key={appointment.id}><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="portal-heading font-medium">{appointment.title}</p><ViewerTime startAt={appointment.startAt.toISOString()} endAt={appointment.endAt?.toISOString() ?? null} /><p className="portal-copy mt-1 text-xs">{appointment.calendarName || "Mercury Call Desk calendar"} · {title(appointment.status)}</p></div><span className={appointment.status === "NO_SHOW" ? "portal-status-pending text-sm font-semibold" : "portal-copy text-sm"}>{title(appointment.status)}</span></div><p className="portal-copy mt-2 text-sm">{outcomeMessage(appointment.status)}</p></article>)}</div></section>}
      </PortalFeaturePage>
    );
  }

  if (workspace === "training") {
    const certification = agent?.certifications[0];
    return <PortalFeaturePage eyebrow="Readiness" title="Training" description="Track your path from completed onboarding to manager-approved lead access."><section className="grid max-w-4xl gap-5 md:grid-cols-2"><div className="portal-card"><p className="portal-subheading text-xs font-medium uppercase tracking-wide">Certification</p><p className="portal-heading mt-2 text-xl font-semibold">{certification ? title(certification.decision) : "Pending manager review"}</p><p className="portal-copy mt-2 text-sm">Complete required training and any manager-requested practice before certification.</p></div><div className="portal-card"><p className="portal-subheading text-xs font-medium uppercase tracking-wide">Lead access</p><p className={`mt-2 text-xl font-semibold ${agent?.canClaimLeads ? "portal-status-good" : "portal-status-pending"}`}>{agent?.canClaimLeads ? "Enabled" : "Locked"}</p><p className="portal-copy mt-2 text-sm">Manager certification controls lead eligibility.</p></div></section><section className="portal-card max-w-4xl"><h2 className="portal-heading text-lg font-semibold">Training library</h2><p className="portal-copy mt-3 text-sm">Product training, scripts, demo expectations, and role-play material will be published here as the program is finalized.</p></section></PortalFeaturePage>;
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
