"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Props = { leadId: string; phone: string };

async function post(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Action could not be completed.");
}

export function LeadActionPanel({ leadId, phone }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [callbackAt, setCallbackAt] = useState("");
  const [disposition, setDisposition] = useState("NO_ANSWER");

  async function run(path: string, body: Record<string, unknown>) {
    setBusy(true);
    setMessage(null);
    try {
      await post(path, body);
      setMessage("Saved.");
      setNote("");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  function submitNote(event: FormEvent) {
    event.preventDefault();
    void run("/api/portal/actions", { leadId, action: "NOTE", note });
  }

  function submitOutcome(event: FormEvent) {
    event.preventDefault();
    void run("/api/portal/actions", { leadId, action: "DISPOSITION", disposition, note });
  }

  function submitCallback(event: FormEvent) {
    event.preventDefault();
    const dueAt = callbackAt ? new Date(callbackAt).toISOString() : "";
    void run("/api/portal/actions", { leadId, action: "CALLBACK", dueAt, note });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <a className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href={`tel:${phone}`}>Call business</a>
        <button className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-ink-950 disabled:opacity-50" disabled={busy} onClick={() => void run("/api/portal/actions", { leadId, action: "CALL" })} type="button">Log call</button>
        <button className="rounded-lg border border-red-800 px-3 py-2 text-sm text-red-300 disabled:opacity-50" disabled={busy} onClick={() => void run("/api/portal/dnc", { leadId, reason: "Client or prospect requested no further contact." })} type="button">DNC</button>
        <button className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200 disabled:opacity-50" disabled={busy} onClick={() => void run("/api/portal/release", { leadId })} type="button">Release</button>
      </div>
      <form className="rounded-xl border border-ink-700 bg-ink-950 p-4" onSubmit={submitOutcome}>
        <p className="text-sm font-medium text-white">Outcome</p>
        <select className="mt-3 w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-gray-100" onChange={(event) => setDisposition(event.target.value)} value={disposition}>
          <option value="NO_ANSWER">No answer</option><option value="VOICEMAIL">Voicemail</option><option value="CALLBACK_REQUESTED">Callback requested</option><option value="QUALIFIED">Qualified</option><option value="NOT_INTERESTED">Not interested</option><option value="WRONG_NUMBER">Wrong number</option><option value="OUT_OF_BUSINESS">Out of business</option><option value="DEMO_BOOKED">Demo booked</option><option value="FOLLOW_UP">Follow up</option>
        </select>
        <textarea className="mt-3 min-h-24 w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-gray-100" onChange={(event) => setNote(event.target.value)} placeholder="Meaningful outcome note" required value={note} />
        <button className="mt-3 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-ink-950 disabled:opacity-50" disabled={busy} type="submit">Save outcome</button>
      </form>
      <form className="rounded-xl border border-ink-700 bg-ink-950 p-4" onSubmit={submitCallback}>
        <p className="text-sm font-medium text-white">Callback</p>
        <input className="mt-3 w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-gray-100" onChange={(event) => setCallbackAt(event.target.value)} required type="datetime-local" value={callbackAt} />
        <textarea className="mt-3 min-h-20 w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-gray-100" onChange={(event) => setNote(event.target.value)} placeholder="Callback reason" required value={note} />
        <button className="mt-3 rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200 disabled:opacity-50" disabled={busy} type="submit">Schedule callback</button>
      </form>
      <form className="rounded-xl border border-ink-700 bg-ink-950 p-4" onSubmit={submitNote}>
        <p className="text-sm font-medium text-white">Internal note</p>
        <textarea className="mt-3 min-h-20 w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-gray-100" onChange={(event) => setNote(event.target.value)} placeholder="Internal note" required value={note} />
        <button className="mt-3 rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200 disabled:opacity-50" disabled={busy} type="submit">Add note</button>
      </form>
      {message && <p className="text-sm text-gray-300" role="status">{message}</p>}
    </div>
  );
}
