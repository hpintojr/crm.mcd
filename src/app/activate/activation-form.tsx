"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type SetupData = {
  qrDataUrl: string;
  totpSecret: string;
};

export function ActivationForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function post(payload: Record<string, string>) {
    const response = await fetch("/api/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as Record<string, string | boolean>;
    if (!response.ok) throw new Error(String(data.error ?? "Unable to continue."));
    return data;
  }

  async function handlePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await post({ action: "prepare", token, password, confirmPassword });
      setSetup({ qrDataUrl: String(data.qrDataUrl), totpSecret: String(data.totpSecret) });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to prepare activation.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!setup) return;
    setError(null);
    setSubmitting(true);
    try {
      await post({
        action: "complete",
        token,
        password,
        confirmPassword,
        totpSecret: setup.totpSecret,
        totp: code,
      });
      router.replace("/login");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to complete activation.");
    } finally {
      setSubmitting(false);
    }
  }

  if (setup) {
    return (
      <form className="mt-7 space-y-5" onSubmit={handleMfa}>
        {error && <Alert message={error} />}
        <div className="rounded-xl border border-ink-700 bg-ink-950 p-4 text-center">
          <img className="mx-auto h-52 w-52" src={setup.qrDataUrl} alt="Authenticator app setup QR code" />
          <p className="mt-3 text-sm text-gray-400">Scan this code, then enter the six-digit code from your authenticator app.</p>
        </div>
        <Field label="Authentication code" name="totp" value={code} onChange={setCode} inputMode="numeric" maxLength={6} />
        <button className="w-full rounded-lg bg-brand-500 px-6 py-3 font-medium text-ink-950 transition hover:bg-brand-400 disabled:opacity-60" disabled={submitting} type="submit">
          {submitting ? "Activating…" : "Complete activation"}
        </button>
      </form>
    );
  }

  return (
    <form className="mt-7 space-y-5" onSubmit={handlePassword}>
      {error && <Alert message={error} />}
      <Field label="Create password" name="password" type="password" value={password} onChange={setPassword} autoComplete="new-password" />
      <Field label="Confirm password" name="confirmPassword" type="password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
      <p className="text-xs text-gray-500">Use at least 12 characters. The next step connects your authenticator app.</p>
      <button className="w-full rounded-lg bg-brand-500 px-6 py-3 font-medium text-ink-950 transition hover:bg-brand-400 disabled:opacity-60" disabled={submitting} type="submit">
        {submitting ? "Preparing secure setup…" : "Continue to security setup"}
      </button>
    </form>
  );
}

function Alert({ message }: { message: string }) {
  return <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300" role="alert">{message}</div>;
}

function Field({ label, name, type = "text", value, onChange, autoComplete, inputMode, maxLength }: {
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
      <label className="mb-1 block text-sm font-medium text-gray-300" htmlFor={name}>{label}</label>
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
