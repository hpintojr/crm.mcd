import "server-only";

import { createHash } from "node:crypto";

function compact(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") || "";
}

export function normalizeEmail(value: string | null | undefined) {
  const email = compact(value).toLowerCase();
  return email || null;
}

export function normalizePhone(value: string | null | undefined) {
  const digits = compact(value).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

export function normalizeWebsiteDomain(value: string | null | undefined) {
  const input = compact(value).toLowerCase();
  if (!input) return null;

  try {
    const url = new URL(input.includes("://") ? input : `https://${input}`);
    return url.hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

export function normalizeCompanyName(value: string | null | undefined) {
  return compact(value).toLowerCase().replace(/[.,'’"()]/g, "").replace(/\s+/g, " ") || null;
}

type LeadIdentityInput = {
  company: string;
  businessPhone?: string | null;
  email?: string | null;
  website?: string | null;
};

export function buildLeadDedupeKey(input: LeadIdentityInput) {
  const company = normalizeCompanyName(input.company) || "unknown";
  const phone = normalizePhone(input.businessPhone) || "";
  const email = normalizeEmail(input.email) || "";
  const domain = normalizeWebsiteDomain(input.website) || "";
  const basis = [company, phone, email, domain].join("|");
  return createHash("sha256").update(basis).digest("hex");
}
