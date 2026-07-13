import { NextRequest } from "next/server";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";
import {
  adminLeadImportJson,
  adminLeadImportRequestId,
  prepareAdminLeadImportJson,
  readAdminLeadImportRows,
  recordAdminLeadImportFailure,
} from "@/lib/admin-lead-import-request-boundary";
import { previewLeadImport } from "@/lib/lead-import-preview";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const requestId = adminLeadImportRequestId(request);
  if (!features.leads) return adminLeadImportJson({ error: "Not found." }, 404, requestId);
  await requireRole(ADMIN_ROLES);

  const prepared = await prepareAdminLeadImportJson(request, requestId);
  if (!prepared.ok) return prepared.response;

  const input = readAdminLeadImportRows(prepared.raw);
  if (!input.ok) return adminLeadImportJson({ error: input.error }, 422, requestId);

  try {
    return adminLeadImportJson({ rows: previewLeadImport(input.rows) }, 200, requestId);
  } catch (error) {
    recordAdminLeadImportFailure("preview", requestId, error);
    return adminLeadImportJson({ error: "Lead preview failed." }, 500, requestId);
  }
}
