import "server-only";

import {
  authenticatedJson,
  authenticatedRequestId,
  prepareAuthenticatedJson,
} from "@/lib/authenticated-json-boundary";

export const MAX_ADMIN_LEAD_IMPORT_BODY_BYTES = 1_000_000;
export const MAX_ADMIN_LEAD_IMPORT_ROWS = 500;

export const adminLeadImportRequestId = authenticatedRequestId;
export const adminLeadImportJson = authenticatedJson;

export function prepareAdminLeadImportJson(request: Request, requestId: string) {
  return prepareAuthenticatedJson(request, requestId, MAX_ADMIN_LEAD_IMPORT_BODY_BYTES);
}

export type AdminLeadImportRowsResult =
  | { ok: true; rows: unknown[] }
  | { ok: false; error: string };

export function readAdminLeadImportRows(raw: unknown): AdminLeadImportRowsResult {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { rows?: unknown }).rows)) {
    return { ok: false, error: "Provide an object containing a rows array." };
  }

  const rows = (raw as { rows: unknown[] }).rows;
  if (rows.length === 0) return { ok: false, error: "Provide at least one import row." };
  if (rows.length > MAX_ADMIN_LEAD_IMPORT_ROWS) {
    return { ok: false, error: "Import batches are limited to 500 rows." };
  }

  return { ok: true, rows };
}

export function expectedAdminLeadImportFailure(error: unknown): { error: string; status: number } | null {
  if (!(error instanceof Error)) return null;

  if (error.message === "Provide at least one import row.") {
    return { error: "Provide at least one import row.", status: 422 };
  }

  if (error.message === "Import batches are limited to 500 rows.") {
    return { error: "Import batches are limited to 500 rows.", status: 422 };
  }

  return null;
}

export function recordAdminLeadImportFailure(operation: "preview" | "commit", requestId: string, error: unknown) {
  console.error("Admin Lead import request failed.", {
    operation,
    requestId,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
}
