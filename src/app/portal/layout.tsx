import type { ReactNode } from "react";
import { PortalShell } from "@/components/portal-shell";
import { getPortalContext } from "@/lib/portal-context";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const { user, agent, isAdmin } = await getPortalContext();
  const partnerName = agent?.preferredName || agent?.legalName || user.email.split("@")[0] || "Partner";

  return (
    <PortalShell
      partnerName={partnerName}
      email={user.email}
      leadAccessEnabled={agent?.canClaimLeads ?? false}
      isAdmin={isAdmin}
    >
      {children}
    </PortalShell>
  );
}
