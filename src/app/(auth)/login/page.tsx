import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { LoginForm } from "./login-form";

const ADMIN_ROLES = new Set([
  "OWNER",
  "SUPER_ADMIN",
  "SALES_MANAGER",
  "COMPLIANCE_MANAGER",
  "FINANCE_MANAGER",
]);

type LoginPageProps = {
  searchParams: Promise<{ mfa?: string; error?: string }>;
};

function errorMessage(error?: string) {
  if (error === "mfa") return "That authentication code is not valid. Try again.";
  if (error === "locked") return "This account is temporarily locked after too many sign-in attempts.";
  if (error === "credentials") return "We could not sign you in with those credentials.";
  return undefined;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
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
        if (code === "MFA_REQUIRED") redirect("/login?mfa=1");
        if (code === "MFA_INVALID") redirect("/login?mfa=1&error=mfa");
        if (code === "ACCOUNT_LOCKED") redirect("/login?error=locked");
        redirect("/login?error=credentials");
      }
      throw error;
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-16">
      <div className="w-full rounded-2xl border border-ink-700 bg-ink-900 p-7 shadow-xl">
        <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Sign in</h1>
        <p className="mt-2 text-sm text-gray-400">
          Use your Mercury Call Desk credentials to access the secure partner portal.
        </p>
        <LoginForm action={authenticate} showTotp={showTotp} error={errorMessage(params.error)} />
      </div>
    </main>
  );
}
