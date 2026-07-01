import { z } from "zod";

// Public signup payload. Deliberately does NOT include SSN or bank details —
// those are captured later (W-9 e-sign / secure payout provider), never on this form.
export const signupSchema = z.object({
  legalName: z.string().min(2, "Enter your legal name").max(120),
  preferredName: z.string().max(120).optional().or(z.literal("")),
  personalEmail: z.string().email("Enter a valid email"),
  mobile: z.string().min(7, "Enter a valid mobile number").max(32),
  mailingAddress: z.string().max(300).optional().or(z.literal("")),
  emergencyContact: z.string().max(200).optional().or(z.literal("")),
  consent: z.literal(true, {
    errorMap: () => ({ message: "You must agree to be contacted and to e-sign" }),
  }),
  // Honeypot — must stay empty (bot trap). Public form hardening.
  company_url: z.string().max(0).optional().or(z.literal("")),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const applicantStatusSchema = z.enum([
  "SUBMITTED",
  "PENDING_REVIEW",
  "NEEDS_CORRECTION",
  "APPROVED",
  "REJECTED",
  "INVITED",
  "ACTIVE",
  "SUSPENDED",
  "OFFBOARDED",
]);

export const applicantDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().trim().min(3).max(1_000).optional().or(z.literal("")),
});

const onboardingDocTypeSchema = z.enum([
  "SALES_AGREEMENT",
  "NDA_IP",
  "W9_PAYOUT",
  "ACKNOWLEDGMENT",
]);

/**
 * Internal contract for the GHL document-completion webhook. Configure the GHL
 * workflow to include the agent/contact id and the MCD doc type for each event.
 */
export const ghlDocumentWebhookSchema = z
  .object({
    event: z.string().trim().min(1).max(100),
    agentId: z.string().trim().min(1).max(100).optional(),
    contactId: z.string().trim().min(1).max(100).optional(),
    documentId: z.string().trim().min(1).max(200).optional(),
    docType: onboardingDocTypeSchema,
    completedAt: z.coerce.date().optional(),
  })
  .refine((data) => Boolean(data.agentId || data.contactId), {
    message: "agentId or contactId is required",
    path: ["agentId"],
  });

export type ApplicantDecisionInput = z.infer<typeof applicantDecisionSchema>;
export type GhlDocumentWebhookInput = z.infer<typeof ghlDocumentWebhookSchema>;
