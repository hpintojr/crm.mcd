import { notFound } from "next/navigation";
import { PortalFeaturePage } from "@/components/portal-feature-page";

const pages = {
  proposals: { eyebrow: "Sales workflow", title: "Proposals", description: "Sent proposals and status will appear here.", state: "Proposal workspace is planned" },
  schedule: { eyebrow: "Appointments", title: "Schedule", description: "Your booked demos and relevant appointments will appear here.", state: "Schedule relay is next" },
  training: { eyebrow: "Readiness", title: "Training", description: "Training progress and certification will appear here.", state: "Training library is being prepared" },
  resources: { eyebrow: "Reference", title: "Resources", description: "Approved materials for your partner role will be organized here.", state: "Resource library is being prepared" },
  settings: { eyebrow: "Account", title: "Settings", description: "Review your account and workspace preferences.", state: "Account settings are being prepared" },
} as const;

type PageProps = { params: Promise<{ workspace: string }> };

export default async function WorkspacePage({ params }: PageProps) {
  const { workspace } = await params;
  const page = pages[workspace as keyof typeof pages];
  if (!page) notFound();

  return (
    <PortalFeaturePage eyebrow={page.eyebrow} title={page.title} description={page.description}>
      <section className="portal-card max-w-3xl">
        <h2 className="portal-heading text-lg font-semibold">{page.state}</h2>
        <p className="portal-copy mt-3 text-sm">This workspace is visible now so partners know where each operating function will live. Its controlled data connection will be enabled only after the relevant workflow is ready.</p>
      </section>
    </PortalFeaturePage>
  );
}
