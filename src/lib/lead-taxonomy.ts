import "server-only";

import { z } from "zod";

export const leadSources = [
  "GOOGLE_MAPS",
  "INSTAGRAM",
  "REFERRAL",
  "PPC",
  "EMAIL",
  "SMS",
  "LINKEDIN",
  "WEB_FORM",
  "FACEBOOK",
  "OTHER",
] as const;

export const leadPools = ["COLD", "NURTURE", "HOT", "OPEN", "SHARK_TANK", "REFERRAL", "HOUSE"] as const;

export const leadIntakeMethods = ["SCRAPE_IMPORT", "WEB_FORM_SUBMISSION", "DIRECT_MESSAGE", "MANUAL_ENTRY", "API_IMPORT", "REFERRAL_ENTRY"] as const;

export const leadSourcesSchema = z.enum(leadSources);
export const leadPoolsSchema = z.enum(leadPools);
export const leadIntakeMethodSchema = z.enum(leadIntakeMethods);

export type LeadSourceValue = z.infer<typeof leadSourcesSchema>;
export type LeadPoolValue = z.infer<typeof leadPoolsSchema>;
export type LeadIntakeMethodValue = z.infer<typeof leadIntakeMethodSchema>;

export const leadSourceLabels: Record<LeadSourceValue, string> = {
  GOOGLE_MAPS: "Google Maps",
  INSTAGRAM: "Instagram",
  REFERRAL: "Referral",
  PPC: "PPC",
  EMAIL: "Email",
  SMS: "SMS",
  LINKEDIN: "LinkedIn",
  WEB_FORM: "Web Form",
  FACEBOOK: "Facebook",
  OTHER: "Other",
};

export const leadPoolLabels: Record<LeadPoolValue, string> = {
  COLD: "Cold Pool / Prospects",
  NURTURE: "Nurture / Marketing Email Pool",
  HOT: "Hot Leads",
  OPEN: "Open Pool",
  SHARK_TANK: "Shark Tank",
  REFERRAL: "Referral",
  HOUSE: "House",
};

export const leadSourceInputSchema = z.object({
  originalSource: leadSourcesSchema,
  sourceDetail: z.string().trim().max(250).optional(),
  sourceRecordUrl: z.string().trim().url().max(2000).optional(),
  campaignName: z.string().trim().max(200).optional(),
  campaignExternalId: z.string().trim().max(250).optional(),
  intakeMethod: leadIntakeMethodSchema,
  referrerName: z.string().trim().max(200).optional(),
  referrerType: z.enum(["CUSTOMER", "PARTNER", "AGENT", "EMPLOYEE", "VENDOR", "OTHER"]).optional(),
  referrerLeadId: z.string().trim().max(100).optional(),
  utmSource: z.string().trim().max(200).optional(),
  utmMedium: z.string().trim().max(200).optional(),
  utmCampaign: z.string().trim().max(200).optional(),
  utmContent: z.string().trim().max(200).optional(),
  utmTerm: z.string().trim().max(200).optional(),
}).superRefine((value, ctx) => {
  if (value.originalSource === "OTHER" && !value.sourceDetail) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["sourceDetail"], message: "A source detail is required when original source is Other." });
  }
  if (value.originalSource === "REFERRAL" && !value.referrerName) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["referrerName"], message: "A referrer name is required for referral leads." });
  }
});

export const leadImportRowSchema = z.object({
  company: z.string().trim().min(1).max(250),
  contactFirstName: z.string().trim().max(100).optional(),
  contactLastName: z.string().trim().max(100).optional(),
  email: z.string().trim().email().max(320).optional(),
  businessPhone: z.string().trim().min(7).max(40),
  website: z.string().trim().url().max(2000).optional(),
  industry: z.string().trim().max(150).optional(),
  city: z.string().trim().max(150).optional(),
  state: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  timezone: z.string().trim().max(100).optional(),
}).merge(leadSourceInputSchema);

export type LeadImportRow = z.infer<typeof leadImportRowSchema>;

export function assertLeadImportAllowed(row: LeadImportRow) {
  if (row.originalSource === "GOOGLE_MAPS" && row.intakeMethod === "SCRAPE_IMPORT") {
    throw new Error("Google Maps batch scraping/import is blocked. Use an approved data provider or independently sourced business data before importing leads.");
  }
}

export function defaultPoolForSource(source: LeadSourceValue): LeadPoolValue {
  if (source === "REFERRAL") return "REFERRAL";
  return "COLD";
}
