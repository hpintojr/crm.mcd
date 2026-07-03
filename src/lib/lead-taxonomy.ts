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
export const leadIntakeMethods = ["WEB_FORM_SUBMISSION", "DIRECT_MESSAGE", "MANUAL_ENTRY", "API_IMPORT", "REFERRAL_ENTRY"] as const;
export const websiteStatuses = ["UNKNOWN", "LISTED", "NO_WEBSITE_LISTED", "VERIFIED_NO_WEBSITE", "NEEDS_REVIEW"] as const;
export const websiteOpportunityStatuses = ["NOT_EVALUATED", "ELIGIBLE_REVIEW", "BUNDLE_OFFERED", "WEBSITE_ONLY_QUOTE", "WEBSITE_ONLY_WON", "DECLINED", "NOT_ELIGIBLE"] as const;
export const websiteOfferTracks = ["BUNDLE_INCENTIVE", "WEBSITE_ONLY"] as const;

export const leadSourcesSchema = z.enum(leadSources);
export const leadPoolsSchema = z.enum(leadPools);
export const leadIntakeMethodSchema = z.enum(leadIntakeMethods);
export const websiteStatusSchema = z.enum(websiteStatuses);
export const websiteOpportunityStatusSchema = z.enum(websiteOpportunityStatuses);
export const websiteOfferTrackSchema = z.enum(websiteOfferTracks);

export type LeadSourceValue = z.infer<typeof leadSourcesSchema>;
export type LeadPoolValue = z.infer<typeof leadPoolsSchema>;
export type LeadIntakeMethodValue = z.infer<typeof leadIntakeMethodSchema>;
export type WebsiteStatusValue = z.infer<typeof websiteStatusSchema>;
export type WebsiteOpportunityStatusValue = z.infer<typeof websiteOpportunityStatusSchema>;
export type WebsiteOfferTrackValue = z.infer<typeof websiteOfferTrackSchema>;

export const leadSourceLabels: Record<LeadSourceValue, string> = {
  GOOGLE_MAPS: "Google Maps", INSTAGRAM: "Instagram", REFERRAL: "Referral", PPC: "PPC", EMAIL: "Email", SMS: "SMS", LINKEDIN: "LinkedIn", WEB_FORM: "Web Form", FACEBOOK: "Facebook", OTHER: "Other",
};
export const leadPoolLabels: Record<LeadPoolValue, string> = {
  COLD: "Cold Pool / Prospects", NURTURE: "Nurture / Marketing Email Pool", HOT: "Hot Leads", OPEN: "Open Pool", SHARK_TANK: "Shark Tank", REFERRAL: "Referral", HOUSE: "House",
};
export const websiteStatusLabels: Record<WebsiteStatusValue, string> = {
  UNKNOWN: "Website not reviewed", LISTED: "Website listed", NO_WEBSITE_LISTED: "No website listed", VERIFIED_NO_WEBSITE: "No website verified", NEEDS_REVIEW: "Website needs review",
};
export const websiteOpportunityStatusLabels: Record<WebsiteOpportunityStatusValue, string> = {
  NOT_EVALUATED: "Not evaluated", ELIGIBLE_REVIEW: "Website opportunity review", BUNDLE_OFFERED: "Website included with package offered", WEBSITE_ONLY_QUOTE: "Website-only quote sent", WEBSITE_ONLY_WON: "Website-only won", DECLINED: "Website offer declined", NOT_ELIGIBLE: "Not eligible",
};

const leadSourceFieldsSchema = z.object({
  originalSource: leadSourcesSchema,
  sourceDetail: z.string().trim().max(250).optional(),
  sourceRecordUrl: z.string().trim().url().max(2000).optional(),
  campaignName: z.string().trim().max(200).optional(),
  campaignExternalId: z.string().trim().max(250).optional(),
  intakeMethod: leadIntakeMethodSchema,
  referrerName: z.string().trim().max(200).optional(),
  referrerType: z.enum(["CUSTOMER", "PARTNER", "AGENT", "EMPLOYEE", "VENDOR", "OTHER"]).optional(),
  referrerLeadId: z.string().trim().max(100).optional(),
  utmSource: z.string().trim().max(200).optional(), utmMedium: z.string().trim().max(200).optional(), utmCampaign: z.string().trim().max(200).optional(), utmContent: z.string().trim().max(200).optional(), utmTerm: z.string().trim().max(200).optional(),
});
type LeadSourceFields = z.infer<typeof leadSourceFieldsSchema>;
function validateLeadSource(value: LeadSourceFields, ctx: z.RefinementCtx) {
  if (value.originalSource === "OTHER" && !value.sourceDetail) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["sourceDetail"], message: "A source detail is required when original source is Other." });
  if (value.originalSource === "REFERRAL" && !value.referrerName) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["referrerName"], message: "A referrer name is required for referral leads." });
}
export const leadSourceInputSchema = leadSourceFieldsSchema.superRefine(validateLeadSource);
export const leadWebsiteInputSchema = z.object({ websiteStatus: websiteStatusSchema, websiteReviewedAt: z.coerce.date().optional(), websiteReviewNote: z.string().trim().max(1000).optional() }).superRefine((value, ctx) => {
  if (value.websiteStatus === "VERIFIED_NO_WEBSITE" && !value.websiteReviewedAt) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["websiteReviewedAt"], message: "A review date is required when no website has been verified." });
});
export const websiteOpportunityInputSchema = z.object({ status: websiteOpportunityStatusSchema, offerTrack: websiteOfferTrackSchema.optional(), quotedAmountCents: z.number().int().min(50_000).max(300_000).optional(), quoteExpiresAt: z.coerce.date().optional(), scopeNote: z.string().trim().max(4000).optional() }).superRefine((value, ctx) => {
  if (value.status === "WEBSITE_ONLY_QUOTE" && value.offerTrack !== "WEBSITE_ONLY") ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["offerTrack"], message: "Website-only quotes must use the website-only offer track." });
  if (value.status === "WEBSITE_ONLY_QUOTE" && !value.quotedAmountCents) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["quotedAmountCents"], message: "A quoted website amount is required." });
});
const leadImportBaseSchema = z.object({ company: z.string().trim().min(1).max(250), contactFirstName: z.string().trim().max(100).optional(), contactLastName: z.string().trim().max(100).optional(), email: z.string().trim().email().max(320).optional(), businessPhone: z.string().trim().min(7).max(40).optional(), website: z.string().trim().url().max(2000).optional(), industry: z.string().trim().max(150).optional(), city: z.string().trim().max(150).optional(), state: z.string().trim().max(100).optional(), country: z.string().trim().max(100).optional(), timezone: z.string().trim().max(100).optional() });
export const leadImportRowSchema = leadImportBaseSchema.merge(leadSourceFieldsSchema).superRefine((value, ctx) => {
  validateLeadSource(value, ctx);
  if (!value.email && !value.businessPhone) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["businessPhone"], message: "At least one contact route, email or business phone, is required." });
});
export type LeadImportRow = z.infer<typeof leadImportRowSchema>;
export function defaultPoolForSource(source: LeadSourceValue): LeadPoolValue { return source === "REFERRAL" ? "REFERRAL" : "COLD"; }
export function websiteStatusFromRecordedUrl(website?: string | null): WebsiteStatusValue { return website?.trim() ? "LISTED" : "NO_WEBSITE_LISTED"; }
export function defaultWebsiteOpportunityStatus(websiteStatus: WebsiteStatusValue): WebsiteOpportunityStatusValue { return websiteStatus === "VERIFIED_NO_WEBSITE" ? "ELIGIBLE_REVIEW" : "NOT_EVALUATED"; }
