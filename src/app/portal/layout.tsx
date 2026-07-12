import type { ReactNode } from "react";
import { PortalShell } from "@/components/portal-shell";
import { features } from "@/lib/features";
import { getPortalContext } from "@/lib/portal-context";
import { routeTrace } from "@/lib/route-trace";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  routeTrace("portal layout entered");
  const { user, agent, isAdmin } = await getPortalContext();
  const partnerName = agent?.preferredName || agent?.legalName || user.email.split("@")[0] || "Partner";

  return (
    <PortalShell
      partnerName={partnerName}
      email={user.email}
      leadAccessEnabled={agent?.canClaimLeads ?? false}
      servicingAccessEnabled={features.servicing}
      isAdmin={isAdmin}
    >
      {children}
    </PortalShell>
  );
}
