import "server-only";

export function activationEmail(input: { activationUrl: string; expiresAt: Date }) {
  const expires = input.expiresAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Los_Angeles",
  });

  const subject = "Activate your Mercury Call Desk partner account";

  const text = [
    "Your Mercury Call Desk onboarding documents are complete.",
    "",
    `Activate your account: ${input.activationUrl}`,
    "",
    `This link expires ${expires} Pacific and can only be used once.`,
    "",
    "If you weren't expecting this, you can safely ignore this email.",
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 480px; margin: 0 auto; color:#111;">
      <p>Your Mercury Call Desk onboarding documents are complete.</p>
      <p>
        <a href="${input.activationUrl}"
           style="display:inline-block;padding:12px 20px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px;">
          Activate your account
        </a>
      </p>
      <p style="font-size:13px;color:#555;">
        This link expires ${expires} Pacific and can only be used once.
        If you weren't expecting this, you can safely ignore this email.
      </p>
    </div>
  `;

  return { subject, text, html };
}
