"use client";

import { FormEvent, useState } from "react";
import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

const ADMIN_ROLES = new Set([
  "OWNER",
  "SUPER_ADMIN",
  "SALES_MANAGER",
  "COMPLIANCE_MANAGER",
  "FINANCE_MANAGER",
]);

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [showTotp, setShowTotp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      totp,
      redirect: false,
    });

    const errorCode = result?.code ?? result?.error ?? "";
    if (!result || result.error) {
      if (errorCode.includes("MFA")) {
        setShowTotp(true);
        setError(
          errorCode.includes("INVALID")
            ? "That authentication code is not valid. Try again."
            : "Enter the six-digit code from your authenticator app.",
        );
      } else if (errorCode.includes("LOCKED")) {
        setError("This account is temporarily locked after too many sign-in attempts.");
      } else {
        setError("We could not sign you in with those credentials.");
      }
      setSubmitting(false);
      return;
    }

    const session = await getSession();
    const role = session?.user?.role;
    router.replace(role && ADMIN_ROLES.has(role) ? "/admin" : "/portal");
    router.refresh();
  }

  return (
    <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300" role="alert">
          {error}
        </div>
      )}

      <Field label="Email" name="email" type="email" value={email} onChange={setEmail} autoComplete="email" />
      <Field
        label="Password"
        name="password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
      />

      {showTotp && (
        <Field
          label="Authentication code"
          name="totp"
          inputMode="numeric"
          maxLength={6}
          value={totp}
          onChange={setTotp}
          autoComplete="one-time-code"
        />
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-brand-500 px-6 py-3 font-medium text-ink-950 transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  value,
  onChange,
  autoComplete,
  inputMode,
  maxLength,
}: {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  inputMode?: "numeric";
  maxLength?: number;
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
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        className="w-full rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-gray-100 outline-none focus:border-brand-500"
      />
    </div>
  );
}
