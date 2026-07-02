import { PortalFeaturePage } from "@/components/portal-feature-page";
import { getPortalContext } from "@/lib/portal-context";
import { features } from "@/lib/features";

export default async function LeadsPage() {
  const { agent } = await getPortalContext();
  const enabled = features.leads;

  return (
    <PortalFeaturePage eyebrow="Pipeline" title="Leads" description="Assigned leads and future open-pool opportunities will be managed here.">
      <section className="portal-card max-w-3xl">
        <h2 className="portal-heading text-lg font-semibold">{enabled ? "Lead workspace" : "Lead workspace is staged"}</h2>
        <p className="portal-copy mt-3 text-sm">
          {enabled
            ? "The controlled lead module is enabled for your workspace."
            : "The lead module is intentionally held until assignment rules, controlled migrations, and operational testing are complete."}
        </p>
        <div className="portal-callout mt-5 text-sm">
          <span className={`font-medium ${agent?.canClaimLeads ? "portal-status-good" : "portal-status-pending"}`}>{agent?.canClaimLeads ? "Certification recorded" : "Certification required"}</span>
          <span className="portal-muted"> · Lead records will appear here when the rollout is enabled.</span>
        </div>
      </section>
    </PortalFeaturePage>
  );
}
