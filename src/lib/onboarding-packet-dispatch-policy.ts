import type { OnboardingDocumentType } from "@/lib/ghl-documents";

export type DocumentSendResult =
  | { documentType: OnboardingDocumentType; ok: true; ghlDocumentId: string; signingUrl: string }
  | { documentType: OnboardingDocumentType; ok: false; error: string };

export type DispatchDecision =
  | { sendEmail: true; links: { documentType: OnboardingDocumentType; ghlDocumentId: string; signingUrl: string }[] }
  | { sendEmail: false; failures: { documentType: OnboardingDocumentType; error: string }[] };

/**
 * Pure fail-closed decision: send the one composed email only if every one of the four
 * document sends succeeded. Any single failure blocks the email entirely — no partial
 * links ever reach an applicant, mirroring the fail-closed pattern in the admin approval
 * gate (PR #140). Network-free and fully covered by
 * scripts/check-onboarding-packet-coordinator.ts with synthetic data.
 */
export function resolveDispatchDecision(results: DocumentSendResult[]): DispatchDecision {
  const failures = results.filter((result): result is Extract<DocumentSendResult, { ok: false }> => !result.ok);
  if (failures.length > 0) {
    return {
      sendEmail: false,
      failures: failures.map((failure) => ({ documentType: failure.documentType, error: failure.error })),
    };
  }

  const succeeded = results as Extract<DocumentSendResult, { ok: true }>[];
  return {
    sendEmail: true,
    links: succeeded.map((result) => ({
      documentType: result.documentType,
      ghlDocumentId: result.ghlDocumentId,
      signingUrl: result.signingUrl,
    })),
  };
}
