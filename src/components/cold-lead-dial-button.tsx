"use client";

import { useState } from "react";

type DialState = "idle" | "logging" | "logged" | "error";

type ColdLeadDialButtonProps = {
  leadId: string;
  phone: string;
};

function telHref(phone: string) {
  return `tel:${phone.replace(/[^+\d]/g, "")}`;
}

export function ColdLeadDialButton({ leadId, phone }: ColdLeadDialButtonProps) {
  const [state, setState] = useState<DialState>("idle");
  const [message, setMessage] = useState<string>("Click to call logs activity first. It does not claim or reserve the Lead.");

  async function startCall() {
    if (state === "logging") return;
    setState("logging");
    setMessage("Logging call activity before opening dialer…");

    try {
      const response = await fetch("/api/portal/leads/call-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Unable to log call activity.");
      setState("logged");
      setMessage("Call activity logged. Opening dialer now — no ownership was created.");
      window.location.href = telHref(phone);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Unable to log call activity.");
    }
  }

  return (
    <div className="space-y-2 sm:col-span-2">
      <button className="w-full rounded-lg bg-brand-500 px-4 py-2 text-center text-sm font-medium text-ink-950 hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-70" disabled={state === "logging"} onClick={startCall} type="button">
        {state === "logging" ? "Logging activity…" : "Click to call lead"}
      </button>
      <p className={`text-xs ${state === "error" ? "text-red-300" : "portal-copy"}`}>{message}</p>
      {state === "error" && <a className="inline-flex text-xs font-medium text-brand-300 underline" href={telHref(phone)}>Open dialer without logging</a>}
    </div>
  );
}
