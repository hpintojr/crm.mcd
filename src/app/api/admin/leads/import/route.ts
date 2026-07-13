import { NextRequest } from "next/server";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";
import {
  adminLeadImportJson,
  adminLeadImportRequestId,
  expectedAdminLeadImportFailure,
  prepareAdminLeadImportJson,
  readAdminLeadImportRows,
  recordAdminLeadImportFailure,
} from "@/lib/admin-lead-import-request-boundary";
import { commitLeadImport } from "@/lib/lead-import-commit";

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
    const result = await commitLeadImport(input.rows);
    return adminLeadImportJson(result, 201, requestId);
  } catch (error) {
    const expected = expectedAdminLeadImportFailure(error);
    if (expected) return adminLeadImportJson({ error: expected.error }, expected.status, requestId);

    recordAdminLeadImportFailure("commit", requestId, error);
    return adminLeadImportJson({ error: "Lead import failed." }, 500, requestId);
  }
}
