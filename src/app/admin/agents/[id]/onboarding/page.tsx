import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

type DocType = "SALES_AGREEMENT" | "NDA_IP" | "W9_PAYOUT" | "ACKNOWLEDGMENT";
type Status = "PENDING" | "SENT" | "VIEWED" | "SIGNED" | "COMPLETED" | "REJECTED";

const documents: Array<{ type: DocType; label: string; detail: string }> = [
  { type: "SALES_AGREEMENT", label: "Sales Partner Agreement", detail: "Agreement status only; legal terms and document content remain with the approved signing process." },
  { type: "NDA_IP", label: "NDA / Confidentiality and IP", detail: "Confidentiality and IP agreement completion status." },
  { type: "W9_PAYOUT", label: "Tax and payout onboarding acknowledgment", detail: "Tracking only. Do not upload tax forms, bank information, or payment details into the MiniCRM." },
  { type: "ACKNOWLEDGMENT", label: "New Hire Acknowledgment", detail: "Acknowledgment of onboarding, compliance, and operational expectations." },
];

const documentSchema = z.object({
  agentId: z.string().cuid(),
  docType: z.enum(["SALES_AGREEMENT", "NDA_IP", "W9_PAYOUT", "ACKNOWLEDGMENT"]),
  status: z.enum(["PENDING", "SENT", "VIEWED", "SIGNED", "COMPLETED", "REJECTED"]),
  version: z.string().trim().max(100).optional(),
  ghlDocumentId: z.string().trim().max(200).optional(),
  countersigned: z.boolean(),
  note: z.string().trim().min(3).max(2_000),
});

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function pacific(value: Date | null) {
  return value ? value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" }) : "—";
}

export default async function AgentOnboardingDocumentsPage({ params }: PageProps) {
  await requireRole(ADMIN_ROLES);
  const { id } = await params;
  const agent = await db.agent.findUnique({ where: { id }, include: { onboardingDocs: true } });
  if (!agent) notFound();
  const docsByType = new Map(agent.onboardingDocs.map((document) => [document.docType, document]));
  const completed = agent.onboardingDocs.filter((document) => document.status === "COMPLETED").length;

  async function recordDocument(formData: FormData) {
    "use server";
    const actor = await requireRole(ADMIN_ROLES);
    const parsed = documentSchema.parse({
      agentId: formData.get("agentId"),
      docType: formData.get("docType"),
      status: formData.get("status"),
      version: formData.get("version") || undefined,
      ghlDocumentId: formData.get("ghlDocumentId") || undefined,
      countersigned: formData.get("countersigned") === "on",
      note: formData.get("note"),
    });
    const current = await db.agent.findUnique({ where: { id: parsed.agentId }, select: { id: true } });
    if (!current) throw new Error("Agent not found.");
    const now = new Date();
    const completedAt = parsed.status === "COMPLETED" ? now : null;
    await db.$transaction([
      db.onboardingDocument.upsert({
        where: { agentId_docType: { agentId: current.id, docType: parsed.docType } },
        create: { agentId: current.id, docType: parsed.docType, status: parsed.status, version: parsed.version || null, ghlDocumentId: parsed.ghlDocumentId || null, countersigned: parsed.countersigned, completedAt },
        update: { status: parsed.status, version: parsed.version || null, ghlDocumentId: parsed.ghlDocumentId || null, countersigned: parsed.countersigned, completedAt },
      }),
      db.auditLog.create({ data: { actorUserId: actor.id, actorRole: actor.role, actionType: "AGENT_ONBOARDING_DOCUMENT_RECORDED", entityType: "Agent", entityId: current.id, reason: parsed.note, metadata: { docType: parsed.docType, status: parsed.status, version: parsed.version || null, countersigned: parsed.countersigned } } }),
    ]);
    revalidatePath(`/admin/agents/${current.id}/onboarding`);
    revalidatePath(`/admin/agents/${current.id}/certify`);
    revalidatePath("/admin/agents");
    revalidatePath("/admin/audit");
  }

  return <main className="mx-auto min-h-screen max-w-6xl px-6 py-12"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">Onboarding documents</h1><p className="mt-2 text-gray-400">Track approved signing-process status for {agent.preferredName || agent.legalName}. MiniCRM stores document status and audit evidence only.</p></div><div className="flex flex-wrap gap-2"><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/agents">Agent operations</Link><Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={`/admin/agents/${agent.id}/certify`}>Certification</Link></div></div><section className="mt-6 rounded-xl border border-ink-700 bg-ink-900 px-5 py-4 text-sm text-gray-300"><strong className="text-white">Document completion: {completed} / 4.</strong> Mark a document Completed only after the approved external signing process confirms it. Do not put tax forms, banking data, signatures, or raw document contents into this workspace.</section><section className="mt-8 space-y-4">{documents.map((definition) => { const document = docsByType.get(definition.type); return <article className="rounded-2xl border border-ink-700 bg-ink-900 p-5" key={definition.type}><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-semibold text-white">{definition.label}</h2><p className="mt-2 text-sm text-gray-400">{definition.detail}</p><p className="mt-2 text-xs text-gray-500">Current status: {document ? label(document.status) : "Pending"} · Completed {pacific(document?.completedAt || null)}</p></div><span className={document?.status === "COMPLETED" ? "rounded-full border border-emerald-700 px-2.5 py-1 text-xs text-emerald-200" : "rounded-full border border-amber-700 px-2.5 py-1 text-xs text-amber-200"}>{document?.status === "COMPLETED" ? "Complete" : "Needs review"}</span></div><form action={recordDocument} className="mt-5 grid gap-3 border-t border-ink-700 pt-5"><input name="agentId" type="hidden" value={agent.id} /><input name="docType" type="hidden" value={definition.type} /><div className="grid gap-3 md:grid-cols-3"><select className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" defaultValue={document?.status || "PENDING"} name="status">{(["PENDING", "SENT", "VIEWED", "SIGNED", "COMPLETED", "REJECTED"] as Status[]).map((status) => <option key={status} value={status}>{label(status)}</option>)}</select><input className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" defaultValue={document?.version || ""} name="version" placeholder="Document version (optional)" /><input className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" defaultValue={document?.ghlDocumentId || ""} name="ghlDocumentId" placeholder="External document reference (optional)" /></div><label className="flex items-center gap-2 text-sm text-gray-300"><input defaultChecked={document?.countersigned || false} name="countersigned" type="checkbox" />Countersigned / externally confirmed when required</label><div className="grid gap-3 md:grid-cols-[1fr_auto]"><textarea className="min-h-24 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="note" placeholder="Status evidence or correction note" required /><button className="rounded-lg border border-brand-500 px-4 py-2 text-sm text-brand-200" type="submit">Save document status</button></div></form></article>; })}</section></main>;
}
