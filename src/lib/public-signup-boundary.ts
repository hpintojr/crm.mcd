import type { SignupInput } from "@/lib/validation";

export const MAX_PUBLIC_SIGNUP_BODY_BYTES = 16_384;

export type NormalizedSignupInput = SignupInput & {
  companyName: string;
  preferredName: string;
  mailingAddress: string;
  emergencyContact: string;
  company_url: string;
};

export function normalizePublicSignupInput(input: SignupInput): NormalizedSignupInput {
  return {
    ...input,
    legalName: input.legalName.trim(),
    companyName: input.companyName?.trim() ?? "",
    preferredName: input.preferredName?.trim() ?? "",
    personalEmail: input.personalEmail.trim().toLowerCase(),
    mobile: input.mobile.trim(),
    mailingAddress: input.mailingAddress?.trim() ?? "",
    emergencyContact: input.emergencyContact?.trim() ?? "",
    company_url: input.company_url?.trim() ?? "",
  };
}

export function isDuplicateAgentEmailError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002");
}
