import type { CreateLeadImportBatchInput } from "@/lib/lead-import-contract";

export const MAX_ROW_UPLOAD_RETRIES = 2;

type PrismaErrorLike = { code?: unknown };

type ExistingLeadImportBatchIdentity = {
  localRunId: string;
  operatorName: string;
  sourceAdapter: string;
  sourceAdapterVersion: string;
  manifestHash: string;
  clientVersion: string;
  keyId: string | null;
};

export class LeadImportBatchReplayConflictError extends Error {
  constructor() {
    super("A batch with this local run ID already exists with different immutable import metadata.");
  }
}

export function isLeadImportUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && (error as PrismaErrorLike).code === "P2002";
}

export function assertImmutableLeadImportBatchReplay(
  existing: ExistingLeadImportBatchIdentity,
  incoming: CreateLeadImportBatchInput,
  keyId: string
) {
  const matches =
    existing.localRunId === incoming.localRunId &&
    existing.operatorName === incoming.operatorName &&
    existing.sourceAdapter === incoming.sourceAdapter &&
    existing.sourceAdapterVersion === incoming.sourceAdapterVersion &&
    existing.manifestHash === incoming.manifestHash &&
    existing.clientVersion === incoming.clientVersion &&
    existing.keyId === keyId;

  if (!matches) throw new LeadImportBatchReplayConflictError();
}
