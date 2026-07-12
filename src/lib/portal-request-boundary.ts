import "server-only";

import {
  authenticatedJson,
  authenticatedNoContent,
  authenticatedRequestId,
  MAX_AUTHENTICATED_JSON_BODY_BYTES,
  prepareAuthenticatedJson,
} from "@/lib/authenticated-json-boundary";

export const MAX_PORTAL_WRITE_BODY_BYTES = MAX_AUTHENTICATED_JSON_BODY_BYTES;
export const portalRequestId = authenticatedRequestId;
export const portalJson = authenticatedJson;
export const portalNoContent = authenticatedNoContent;
export const preparePortalJson = prepareAuthenticatedJson;

export function expectedColdLeadCallFailure(error: unknown): { error: string; status: number } | null {
  if (!(error instanceof Error)) return null;

  if (error.message === "Lead access is pending manager certification.") {
    return { error: "Lead access is pending manager certification.", status: 403 };
  }

  if (error.message.startsWith("Admins may only act on controlled test Leads.")) {
    return { error: "This action is not available for this Lead.", status: 403 };
  }

  if (error.message === "This Cold Lead is no longer available for activity logging.") {
    return { error: "This Lead is no longer available for activity logging.", status: 409 };
  }

  return null;
}
