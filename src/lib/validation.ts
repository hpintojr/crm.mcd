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
