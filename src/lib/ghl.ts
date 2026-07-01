// GoHighLevel API v2 client (server-only).
// GHL is a one-way backend: the MiniCRM writes at onboarding/handoff and receives events via webhooks.
// Agents NEVER get GHL logins. If the token isn't configured yet, calls run in a safe stub mode
// so the app is fully runnable before the GHL account is wired.

import { env, ghlConfigured } from "@/lib/env";

type UpsertContactInput = {
  legalName: string;
  preferredName?: string | null;
  personalEmail: string;
  mobile: string;
  mailingAddress?: string | null;
  // Attribution custom fields (Flow B) — keyed by your GHL custom-field ids at wire-up time.
  customFields?: Record<string, string>;
  tags?: string[];
};

type GhlResult<T> = { ok: true; stub?: boolean; data: T } | { ok: false; error: string };

function headers() {
  return {
    Authorization: `Bearer ${env.ghl.token}`,
    Version: env.ghl.apiVersion,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/**
 * Create or update a Contact in the Sales HQ sub-account and stamp attribution fields.
 * Returns the GHL contact id. In stub mode (no token) returns a synthetic id so the
 * onboarding flow is testable end-to-end locally.
 */
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
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "GHL request error" };
  }
}

/**
 * Adds tags to an existing Sales HQ contact. Approval uses `agent-approved` to start
 * the GHL document workflow. The CRM does not advance local state if this call fails.
 */
export async function addSalesHqContactTags(
  contactId: string,
  tags: string[],
): Promise<GhlResult<{ contactId: string }>> {
  if (!ghlConfigured) {
    return { ok: true, stub: true, data: { contactId } };
  }

  try {
    const res = await fetch(
      `${env.ghl.apiBase}/contacts/${encodeURIComponent(contactId)}/tags`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ tags }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `GHL tag update failed (${res.status}): ${text.slice(0, 300)}` };
    }

    return { ok: true, data: { contactId } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "GHL tag request error" };
  }
}
