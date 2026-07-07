export const MAX_ROW_UPLOAD_RETRIES = 2;

type PrismaErrorLike = { code?: unknown };

export function isLeadImportUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && (error as PrismaErrorLike).code === "P2002";
}
