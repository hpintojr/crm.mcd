import { z } from "zod";

export const MAX_ACTIVATION_BODY_BYTES = 8_192;

const tokenSchema = z.string().trim().min(1).max(512);
const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(256)
  .refine((value) => /\S/.test(value), "Password must include a non-whitespace character");
const confirmPasswordSchema = z.string().max(256);

const common = {
  token: tokenSchema,
  password: passwordSchema,
  confirmPassword: confirmPasswordSchema,
};

export const activationRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("prepare"), ...common }),
  z.object({
    action: z.literal("complete"),
    ...common,
    totpSecret: z.string().trim().min(16).max(128).regex(/^[A-Z2-7]+$/i),
    totp: z.string().trim().regex(/^\d{6}$/),
  }),
]);

export type ActivationRequest = z.infer<typeof activationRequestSchema>;

export class ActivationUnavailableError extends Error {
  constructor() {
    super("Activation token is unavailable.");
    this.name = "ActivationUnavailableError";
  }
}

export function isActivationUnavailableError(error: unknown): error is ActivationUnavailableError {
  return error instanceof ActivationUnavailableError;
}
