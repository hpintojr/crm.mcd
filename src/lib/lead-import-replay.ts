import type { LeadImportRowEnvelope } from "@/lib/lead-import-payload-schema";

/**
 * A retry may repeat an already staged row, but it must not change the row
 * content. This stays independent of the client-side row-hash serialization
 * convention by comparing both the declared hash and a canonical JSON value.
 */

export type ExistingLeadImportReplayRow = {
  rowNumber: number;
  rowHash: string;
  idempotencyKey: string;
  payload: unknown;
};

function canonicalJson(value: unknown): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "boolean":
    case "number":
    case "string":
      return JSON.stringify(value);
    case "object": {
      if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;

      const record = value as Record<string, unknown>;
      return `{${Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
        .join(",")}}`;
    }
    default:
      throw new Error("Lead-import payload must be valid JSON.");
  }
}

export function assertImmutableLeadImportReplay(
  existing: ExistingLeadImportReplayRow,
  incoming: LeadImportRowEnvelope
) {
  if (existing.rowNumber !== incoming.rowNumber) {
    throw new Error(
      `Idempotency key ${incoming.idempotencyKey} is already associated with row ${existing.rowNumber}.`
    );
  }

  if (existing.idempotencyKey !== incoming.idempotencyKey) {
    throw new Error(
      `Row ${incoming.rowNumber} already exists with a different idempotency key.`
    );
  }

  if (existing.rowHash.toLowerCase() !== incoming.rowHash.toLowerCase()) {
    throw new Error(
      `Replay conflict for row ${incoming.rowNumber}: the idempotency identity was reused with a different row hash.`
    );
  }

  if (canonicalJson(existing.payload) !== canonicalJson(incoming.row)) {
    throw new Error(
      `Replay conflict for row ${incoming.rowNumber}: the idempotency identity was reused with different row content.`
    );
  }
}
