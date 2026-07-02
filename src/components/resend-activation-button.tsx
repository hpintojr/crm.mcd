"use client";

import { useFormStatus } from "react-dom";

type ResendActivationButtonProps = {
  disabled: boolean;
  label: string;
};

export function ResendActivationButton({ disabled, label }: ResendActivationButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      className="w-full rounded-lg border border-brand-500 px-3 py-2 text-sm font-medium text-brand-300 transition hover:bg-brand-500/10 disabled:cursor-not-allowed disabled:opacity-50"
      type="submit"
      disabled={disabled || pending}
    >
      {pending ? "Sending activation email…" : label}
    </button>
  );
}
