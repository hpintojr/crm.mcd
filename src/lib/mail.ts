// Server-side transactional email via the company IONOS mailbox (SMTP).
// Never throws: if SMTP isn't configured yet (mailbox not provisioned), callers get
// { ok: true, stub: true } so onboarding/provisioning flows never fail on delivery.
import "server-only";

import nodemailer from "nodemailer";
import { env, smtpConfigured } from "@/lib/env";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!smtpConfigured) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.password },
    });
  }
  return transporter;
}

export type SendMailResult = { ok: true; stub?: boolean } | { ok: false; error: string };

export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<SendMailResult> {
  const client = getTransporter();
  if (!client) {
    return { ok: true, stub: true };
  }

  try {
    await client.sendMail({
      from: `"${env.smtp.fromName}" <${env.smtp.fromAddress}>`,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "SMTP send error" };
  }
}
