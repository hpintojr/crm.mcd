import type { Metadata } from "next";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/password";
import { ActivationForm } from "./activation-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};

type ActivatePageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ActivatePage({ searchParams }: ActivatePageProps) {
  const { token } = await searchParams;
  const rawToken = token?.trim();
  const activation = rawToken && rawToken.length <= 512
    ? await db.activationToken.findFirst({
        where: {
          tokenHash: hashToken(rawToken),
          purpose: "ACTIVATION",
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: { user: { select: { email: true, status: true } } },
      })
    : null;

  if (!rawToken || !activation || activation.user.status === "DISABLED") {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-6 py-16">
        <div className="w-full rounded-2xl border border-red-800 bg-ink-900 p-8 text-center">
          <h1 className="text-2xl font-semibold text-white">Activation link unavailable</h1>
          <p className="mt-3 text-gray-400">
            This link is invalid, expired, or has already been used. Please contact Mercury Call Desk for a new one.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-6 py-16">
      <div className="w-full rounded-2xl border border-ink-700 bg-ink-900 p-7 shadow-xl">
        <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Activate your account</h1>
        <p className="mt-2 text-sm text-gray-400">
          Create your password and connect an authenticator app for {activation.user.email}.
        </p>
        <ActivationForm token={rawToken} />
      </div>
    </main>
  );
}
