import { z } from "zod";

export const signupSchema = z.object({
  legalName: z.string().trim().min(2, "Enter your legal name").max(120),
  companyName: z.string().trim().max(160).optional().or(z.literal("")),
  preferredName: z.string().trim().max(120).optional().or(z.literal("")),
  personalEmail: z.string().trim().toLowerCase().email("Enter a valid email"),
  mobile: z.string().trim().min(7, "Enter a valid mobile number").max(32),
  mailingAddress: z.string().trim().max(300).optional().or(z.literal("")),
  emergencyContact: z.string().trim().max(200).optional().or(z.literal("")),
  consent: z.literal(true, { errorMap: () => ({ message: "You must agree to be contacted and to e-sign" }) }),
  company_url: z.string().trim().max(0).optional().or(z.literal("")),
});

export type SignupInput = z.infer<typeof signupSchema>;
