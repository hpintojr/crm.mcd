import Link from "next/link";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { LoginForm } from "./(auth)/login/login-form";

const ADMIN_ROLES = new Set([
  "OWNER",
  "SUPER_ADMIN",
  "SALES_MANAGER",
  "COMPLIANCE_MANAGER",
  "FINANCE_MANAGER",
]);

type HomeProps = {
  searchParams: Promise<{ mfa?: string; error?: string }>;
};

function errorMessage(error?: string) {
  if (error === "mfa") return "That authentication code is not valid. Try again.";
  if (error === "locked") return "This account is temporarily locked after too many sign-in attempts.";
  if (error === "credentials") return "We could not sign you in with those credentials.";
  return undefined;
}

export default async function Home({ searchParams }: HomeProps) {
  const session = await auth();
  const role = session?.user?.role;
  if (session?.user?.id) {
    redirect(role && ADMIN_ROLES.has(role) ? "/admin" : "/portal");
  }

  const params = await searchParams;
  const showTotp = params.mfa === "1";

  async function authenticate(formData: FormData) {
    "use server";

    try {
      await signIn("credentials", formData);
    } catch (error) {
      if (error instanceof AuthError) {
        const code = "code" in error && typeof error.code === "string" ? error.code : "";
        if (code === "MFA_REQUIRED") redirect("/?mfa=1");
        if (code === "MFA_INVALID") redirect("/?mfa=1&error=mfa");
        if (code === "ACCOUNT_LOCKED") redirect("/?error=locked");
        redirect("/?error=credentials");
      }
      throw error;
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-12 text-center">
      <p className="mb-3 text-sm font-medium uppercase tracking-widest text-brand-400">
        Mercury Call Desk
      </p>
      <h1 className="text-4xl font-semibold text-white sm:text-5xl">Mini CRM</h1>
      <p className="mt-4 max-w-xl text-gray-400">
        Secure agent &amp; admin portals. Prospecting, onboarding, compliance, and commissions —
        with GoHighLevel wired in as a one-way backend.
      </p>

      <section className="mt-8 w-full max-w-md rounded-2xl border border-ink-700 bg-ink-900 p-7 text-left shadow-xl">
        <h2 className="text-xl font-semibold text-white">Sign in</h2>
        <p className="mt-2 text-sm text-gray-400">Use your Mercury Call Desk credentials to access the secure portal.</p>
        <LoginForm action={authenticate} showTotp={showTotp} error={errorMessage(params.error)} />
      </section>

      <Link
        href="/signup"
        className="mt-6 rounded-lg border border-ink-700 px-6 py-3 text-sm text-gray-200 transition hover:border-brand-500 hover:text-white"
      >
        Partner sign-up
      </Link>

      <p className="mt-12 text-xs text-gray-600">
        Charter Oaks Assets, Inc. d/b/a Mercury Call Desk · internal system
      </p>
    </main>
  );
}
