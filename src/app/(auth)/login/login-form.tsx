"use client";

import { useEffect, useState } from "react";

type LoginFormProps = {
  initialError?: string | null;
};

/**
 * Uses a native browser POST to Auth.js instead of the client signIn helper.
 * This lets the browser receive the callback response, persist the session
 * cookie, and follow the role-protected callback URL without waiting on a
 * client-side credentials promise.
 */
export function LoginForm({ initialError = null }: LoginFormProps) {
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(true);
  const [error, setError] = useState<string | null>(initialError);

  useEffect(() => {
    let active = true;

    void fetch("/api/auth/csrf", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to prepare the secure sign-in form.");
        return response.json() as Promise<{ csrfToken?: unknown }>;
      })
      .then((payload) => {
        if (!active) return;
        if (typeof payload.csrfToken !== "string" || payload.csrfToken.length === 0) {
          throw new Error("Unable to prepare the secure sign-in form.");
        }
        setCsrfToken(payload.csrfToken);
        setLoadingToken(false);
      })
      .catch(() => {
        if (!active) return;
        setError("We could not prepare secure sign-in. Refresh the page and try again.");
        setLoadingToken(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <form action="/api/auth/callback/credentials" className="mt-7 space-y-5" method="post">
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300" role="alert">
          {error}
        </div>
      )}

      <input name="csrfToken" type="hidden" value={csrfToken ?? ""} />
      <input name="callbackUrl" type="hidden" value="/admin" />

      <Field label="Email" name="email" type="email" autoComplete="email" />
      <Field label="Password" name="password" type="password" autoComplete="current-password" />
      <Field
        label="Authentication code"
        name="totp"
        inputMode="numeric"
        maxLength={6}
        autoComplete="one-time-code"
        hint="Enter your current six-digit code."
      />

      <button
        type="submit"
        disabled={!csrfToken || loadingToken}
        className="w-full rounded-lg bg-brand-500 px-6 py-3 font-medium text-ink-950 transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loadingToken ? "Preparing secure sign-in…" : "Sign in"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  inputMode,
  maxLength,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  inputMode?: "numeric";
  maxLength?: number;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-300" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        className="w-full rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-gray-100 outline-none focus:border-brand-500"
      />
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
