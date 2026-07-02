import { PortalFeaturePage } from "@/components/portal-feature-page";

export default function InboxPage() {
  return (
    <PortalFeaturePage eyebrow="Communication" title="Inbox" description="Assigned work communications will appear here.">
      <section className="portal-card max-w-3xl">
        <h2 className="portal-heading text-lg font-semibold">Inbox setup is next</h2>
        <p className="portal-copy mt-3 text-sm">This space will hold assigned conversations, follow-ups, internal announcements, and relevant activity without exposing unrelated company records.</p>
      </section>
    </PortalFeaturePage>
  );
}
