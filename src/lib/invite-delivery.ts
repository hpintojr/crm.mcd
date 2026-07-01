import "server-only";

import { addContactTag } from "@/lib/ghl";

export async function triggerPortalInvite(contactId: string | null) {
  if (!contactId || contactId.startsWith("stub_")) return { ok: true, skipped: true };
  return addContactTag(contactId, process.env.GHL_PORTAL_INVITE_TAG || "mcd-portal-invite");
}
