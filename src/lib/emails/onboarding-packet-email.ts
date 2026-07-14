import "server-only";

export type OnboardingPacketLink = {
  label: string;
  url: string;
};

/**
 * Composes the single onboarding email containing all four secure document links.
 * Pure and network-free — fully covered by scripts/check-onboarding-packet-coordinator.ts
 * with synthetic data, no live GHL/SMTP calls required to verify this function.
 */
export function onboardingPacketEmail(input: { recipientName: string; links: OnboardingPacketLink[] }) {
  if (input.links.length !== 4) {
    throw new Error(`onboardingPacketEmail requires exactly 4 links, got ${input.links.length}`);
  }

  const subject = "Complete your Mercury Call Desk onboarding — 4 documents to sign";

  const text = [
    `Hi ${input.recipientName},`,
    "",
    "You're approved to start onboarding with Mercury Call Desk. Please review and sign the following four documents:",
    "",
    ...input.links.map((link, i) => `${i + 1}. ${link.label}: ${link.url}`),
    "",
    "Each link is unique to you. Contact support@mercurycalldesk.com with any questions.",
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 480px; margin: 0 auto; color:#111;">
      <p>Hi ${escapeHtml(input.recipientName)},</p>
      <p>You're approved to start onboarding with Mercury Call Desk. Please review and sign the following four documents:</p>
      <ol style="padding-left: 20px;">
        ${input.links
          .map(
            (link) =>
              `<li style="margin-bottom: 10px;"><a href="${escapeHtml(link.url)}" style="color:#0f766e;">${escapeHtml(link.label)}</a></li>`,
          )
          .join("")}
      </ol>
      <p style="font-size:13px;color:#555;">
        Each link is unique to you. Contact support@mercurycalldesk.com with any questions.
      </p>
    </div>
  `;

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}
