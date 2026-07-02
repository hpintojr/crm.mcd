"use client";

import { useState } from "react";

type FieldErrors = Record<string, string[]>;

export default function SignupPage() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const form = new FormData(e.currentTarget);
    const payload = {
      legalName: String(form.get("legalName") || ""),
      companyName: String(form.get("companyName") || ""),
      preferredName: String(form.get("preferredName") || ""),
      personalEmail: String(form.get("personalEmail") || ""),
      mobile: String(form.get("mobile") || ""),
      mailingAddress: String(form.get("mailingAddress") || ""),
      emergencyContact: String(form.get("emergencyContact") || ""),
      consent: form.get("consent") === "on",
      company_url: String(form.get("company_url") || ""),
    };

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.issues?.fieldErrors) setFieldErrors(data.issues.fieldErrors);
        setFormError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }
      setDone(true);
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
        <div className="rounded-2xl border border-ink-700 bg-ink-900 p-8">
          <h1 className="text-2xl font-semibold text-white">Application received</h1>
          <p className="mt-3 text-gray-400">
            Thanks — we&apos;ve got your details. Someone from Mercury Call Desk will call to confirm,
            then your onboarding documents will be sent for signature.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <p className="mb-2 text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
      <h1 className="text-3xl font-semibold text-white">Partner sign-up</h1>
      <p className="mt-2 text-gray-400">
        Enter your details to get started. After a quick confirmation call, we&apos;ll send your agreement, NDA, and W-9 to sign.
      </p>

      {formError && <div className="mt-6 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">{formError}</div>}

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <Field label="Legal name" name="legalName" required errors={fieldErrors.legalName} />
        <Field label="Company / Legal Entity Name" name="companyName" description="Optional — LLC, corporation, or DBA." errors={fieldErrors.companyName} />
        <Field label="Preferred name" name="preferredName" errors={fieldErrors.preferredName} />
        <Field label="Personal email" name="personalEmail" type="email" required errors={fieldErrors.personalEmail} />
        <Field label="Mobile" name="mobile" type="tel" required errors={fieldErrors.mobile} />
        <Field label="Mailing address" name="mailingAddress" errors={fieldErrors.mailingAddress} />
        <Field label="Emergency contact" name="emergencyContact" errors={fieldErrors.emergencyContact} />

        <div className="hidden" aria-hidden="true"><label>Company URL<input name="company_url" tabIndex={-1} autoComplete="off" /></label></div>

        <label className="flex items-start gap-3 text-sm text-gray-300">
          <input type="checkbox" name="consent" className="mt-1 h-4 w-4 rounded border-ink-700 bg-ink-800" />
          <span>I agree to be contacted by Mercury Call Desk and to sign my onboarding documents electronically.</span>
        </label>
        {fieldErrors.consent && <p className="text-sm text-red-400">{fieldErrors.consent[0]}</p>}

        <button type="submit" disabled={submitting} className="w-full rounded-lg bg-brand-500 px-6 py-3 font-medium text-ink-950 transition hover:bg-brand-400 disabled:opacity-60">
          {submitting ? "Submitting…" : "Submit application"}
        </button>

        <p className="text-center text-xs text-gray-600">Your Social Security number is never entered here — it&apos;s collected only inside the secure W-9 when you sign.</p>
      </form>
    </main>
  );
}

function Field({ label, name, type = "text", required, description, errors }: { label: string; name: string; type?: string; required?: boolean; description?: string; errors?: string[] }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium text-gray-300">{label} {required && <span className="text-brand-400">*</span>}</label>
      {description && <p className="mb-2 text-xs text-gray-500">{description}</p>}
      <input id={name} name={name} type={type} required={required} className="w-full rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-gray-100 outline-none focus:border-brand-500" />
      {errors?.[0] && <p className="mt-1 text-sm text-red-400">{errors[0]}</p>}
    </div>
  );
}
