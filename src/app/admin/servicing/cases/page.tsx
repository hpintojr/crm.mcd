import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { listOpenServiceCases } from "@/lib/client-servicing";
import { recordServiceResponse, resolveClientServiceCase } from "@/lib/client-servicing-resolution";
import { features } from "@/lib/features";

export const dynamic = "force-dynamic";

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function pacific(value: Date | null) {
  return value ? value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" }) : "No due time";
}

export default async function ServiceCasesPage() {
  if (!features.servicing) notFound();
  await requireRole(ADMIN_ROLES);
  const cases = await listOpenServiceCases();

  async function recordResponse(formData: FormData) {
    "use server";
    await recordServiceResponse({
      clientAccountId: String(formData.get("clientAccountId") ?? ""),
      serviceCaseId: String(formData.get("serviceCaseId") ?? ""),
      note: String(formData.get("note") ?? ""),
    });
    revalidatePath("/admin/servicing/cases");
    revalidatePath("/admin/servicing");
    revalidatePath("/portal/servicing");
    revalidatePath("/admin/audit");
  }

  async function resolveCase(formData: FormData) {
    "use server";
    await resolveClientServiceCase({
      clientAccountId: String(formData.get("clientAccountId") ?? ""),
      serviceCaseId: String(formData.get("serviceCaseId") ?? ""),
      resolution: String(formData.get("resolution") ?? ""),
    });
    revalidatePath("/admin/servicing/cases");
    revalidatePath("/admin/servicing");
    revalidatePath("/portal/servicing");
    revalidatePath("/admin/readiness");
    revalidatePath("/admin/audit");
  }

  return <main className="mx-auto min-h-screen max-w-6xl px-6 py-12"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">Service cases</h1><p className="mt-2 text-gray-400">Triggered client work ordered by priority and due time. A case is created from a real service trigger, never from a quiet healthy account.</p></div><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/servicing">Client servicing</Link></div><section className="mt-6 rounded-xl border border-ink-700 bg-ink-900 px-5 py-4 text-sm text-gray-300">Record the response when work begins. Resolve only after documenting the outcome. Neither action changes commission eligibility or triggers Finance.</section><section className="mt-8 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">{cases.length === 0 ? <p className="px-6 py-10 text-sm text-gray-400">No open service cases.</p> : <div className="divide-y divide-ink-700">{cases.map((serviceCase) => <article className="px-6 py-5" key={serviceCase.id}><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-medium text-white">{serviceCase.clientName}</p><p className="mt-1 text-sm text-gray-400">{serviceCase.summary}</p><p className="mt-1 text-xs text-gray-500">{label(serviceCase.trigger)} · {label(serviceCase.priority)} · {label(serviceCase.status)} · Due {pacific(serviceCase.dueAt)}</p></div><span className="rounded-full border border-ink-700 px-2.5 py-1 text-xs text-gray-300">{label(serviceCase.status)}</span></div><div className="mt-5 grid gap-3 border-t border-ink-700 pt-5 lg:grid-cols-2"><form action={recordResponse} className="grid gap-2"><input name="clientAccountId" type="hidden" value={serviceCase.clientAccountId} /><input name="serviceCaseId" type="hidden" value={serviceCase.id} /><label className="text-xs text-gray-500">Document response / move to in progress</label><div className="grid grid-cols-[1fr_auto] gap-2"><input className="min-w-0 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="note" placeholder="Response and next action" required /><button className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" type="submit">Record response</button></div></form><form action={resolveCase} className="grid gap-2"><input name="clientAccountId" type="hidden" value={serviceCase.clientAccountId} /><input name="serviceCaseId" type="hidden" value={serviceCase.id} /><label className="text-xs text-gray-500">Document resolution / close case</label><div className="grid grid-cols-[1fr_auto] gap-2"><input className="min-w-0 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="resolution" placeholder="Resolution evidence" required /><button className="rounded-lg border border-emerald-700 px-3 py-2 text-sm text-emerald-200" type="submit">Resolve case</button></div></form></div></article>)}</div>}</section></main>;
}
