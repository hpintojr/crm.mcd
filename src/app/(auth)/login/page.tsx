import { headers } from "next/headers";
import { LoginForm } from "./login-form";

type LoginSearchParams = Promise<{ error?: string; code?: string }>;

function loginState(searchParams: { error?: string; code?: string }) {
  if (searchParams.code === "MFA_REQUIRED") {
    return { initialError: "Enter the six-digit code from your authenticator app.", requiresMfa: true };
  }
  if (searchParams.code === "MFA_INVALID") {
    return { initialError: "That authentication code is not valid. Try again.", requiresMfa: true };
  }
  if (searchParams.code === "ACCOUNT_LOCKED") {
    return { initialError: "This account is temporarily locked after too many sign-in attempts.", requiresMfa: false };
  }
  if (searchParams.error) {
    return { initialError: "We could not sign you in with those credentials.", requiresMfa: false };
  }
  return { initialError: null, requiresMfa: false };
}

export default async function LoginPage({ searchParams }: { searchParams: LoginSearchParams }) {
  const requestHeaders = await headers();
  const resolvedSearchParams = await searchParams;
  const state = loginState(resolvedSearchParams);

  // Temporary Preview-only diagnostic: no secrets, user identifiers, or form
  // values are logged.
  console.info("[route-trace] login-page", {
    host: requestHeaders.get("host"),
    hasError: Boolean(resolvedSearchParams.error),
    code: resolvedSearchParams.code ?? null,
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-16">
      <div className="w-full rounded-2xl border border-ink-700 bg-ink-900 p-7 shadow-xl">
        <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Sign in</h1>
        <p className="mt-2 text-sm text-gray-400">
          Use your Mercury Call Desk credentials to access the secure partner portal.
        </p>
        <LoginForm initialError={state.initialError} requiresMfa={state.requiresMfa} />
      </div>
    </main>
  );
}
