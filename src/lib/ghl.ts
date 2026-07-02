// GoHighLevel API v2 client (server-only).
// GHL is a one-way backend: the MiniCRM writes at onboarding/handoff and receives events via webhooks.
// Agents NEVER get GHL logins. If the token isn't configured yet, calls run in a safe stub mode.

import "server-only";
import { env, ghlConfigured } from "@/lib/env";

type UpsertContactInput = {
  legalName: string;
  companyName?: string | null;
  preferredName?: string | null;
  personalEmail: string;
  mobile: string;
  mailingAddress?: string | null;
  customFields?: Record<string, string>;
  tags?: string[];
};

export type GhlResult<T> = { ok: true; stub?: boolean; data: T } | { ok: false; error: string };

function headers() {
  return {
    Authorization: `Bearer ${env.ghl.token}`,
    Version: env.ghl.apiVersion,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export async function upsertSalesHqContact(
  input: UpsertContactInput,
): Promise<GhlResult<{ contactId: string }>> {
  if (!ghlConfigured) {
    return { ok: true, stub: true, data: { contactId: `stub_${Date.now()}` } };
  }

  try {
    const [firstName, ...rest] = input.legalName.trim().split(" ");
    const res = await fetch(`${env.ghl.apiBase}/contacts/upsert`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        locationId: env.ghl.salesHqLocationId,
        firstName,
        lastName: rest.join(" ") || undefined,
        name: input.preferredName || input.legalName,
        email: input.personalEmail,
        phone: input.mobile,
        address1: input.mailingAddress || undefined,
        tags: input.tags,
        customFields: input.customFields
          ? Object.entries(input.customFields).map(([id, value]) => ({ id, value }))
          : undefined,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `GHL upsert failed (${res.status}): ${text.slice(0, 300)}` };
    }
    const json = (await res.json()) as { contact?: { id?: string }; id?: string };
    const contactId = json.contact?.id ?? json.id;
    if (!contactId) return { ok: false, error: "GHL upsert returned no contact id" };
    return { ok: true, data: { contactId } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "GHL request error" };
  }
}

/** Adds a GHL tag while preserving a stub-safe local workflow before the token is configured. */
export async function addContactTag(contactId: string, tag: string): Promise<GhlResult<{ ok: true }>> {
  if (!ghlConfigured || contactId.startsWith("stub_")) {
    return { ok: true, stub: true, data: { ok: true } };
  }

  try {
    const res = await fetch(`${env.ghl.apiBase}/contacts/${encodeURIComponent(contactId)}/tags`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ tags: [tag] }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `GHL tag failed (${res.status}): ${text.slice(0, 300)}` };
    }
    return { ok: true, data: { ok: true } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "GHL tag request error" };
  }
}
