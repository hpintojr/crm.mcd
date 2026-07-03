type LoginFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  showTotp: boolean;
  error?: string;
};

export function LoginForm({ action, showTotp, error }: LoginFormProps) {
  return (
    <form className="mt-7 space-y-5" action={action}>
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300" role="alert">
          {error}
        </div>
      )}

      <input name="redirectTo" type="hidden" value="/login" />
      <Field label="Email" name="email" type="email" autoComplete="email" />
      <Field label="Password" name="password" type="password" autoComplete="current-password" />

      {showTotp && (
        <Field
          label="Authentication code"
          name="totp"
          inputMode="numeric"
          maxLength={6}
          autoComplete="one-time-code"
        />
      )}

      <button
        type="submit"
        className="w-full rounded-lg bg-brand-500 px-6 py-3 font-medium text-ink-950 transition hover:bg-brand-400"
      >
        {showTotp ? "Verify and sign in" : "Continue"}
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
}: {
  label: string;
  name: string;
  type?: string;
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
        required
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        className="w-full rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-gray-100 outline-none focus:border-brand-500"
      />
    </div>
  );
}
