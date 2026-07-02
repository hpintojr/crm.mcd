import { PortalFeaturePage } from "@/components/portal-feature-page";
import { getPortalContext } from "@/lib/portal-context";

export default async function TasksPage() {
  const { agent } = await getPortalContext();

  return (
    <PortalFeaturePage eyebrow="Daily work" title="Tasks" description="Your callbacks, follow-ups, and booking actions will be organized here.">
      <section className="portal-card max-w-3xl">
        <h2 className="portal-heading text-lg font-semibold">Nothing due right now</h2>
        <p className="portal-copy mt-3 text-sm">
          Task automation will begin when leads and appointments are enabled. Your manager can use this area to keep the next action clear without relying on separate text messages or spreadsheets.
        </p>
        <div className="portal-callout mt-5 text-sm">
          <span className="font-medium portal-heading">Current access:</span>{" "}
          <span className="portal-muted">{agent?.canClaimLeads ? "Lead access is enabled; task workflows are the next operating layer." : "Lead access is locked until manager certification is complete."}</span>
        </div>
      </section>
    </PortalFeaturePage>
  );
}
