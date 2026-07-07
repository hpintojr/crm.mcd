-- Additive lead-research fields. Google Maps remains an outbound link only;
-- no database or application process fetches Maps/review content.
ALTER TABLE "Lead"
  ADD COLUMN "businessAddress" TEXT,
  ADD COLUMN "googleRating" DECIMAL(2,1),
  ADD COLUMN "googleRatingObservedAt" TIMESTAMP(3),
  ADD COLUMN "googleMapsUrl" TEXT;

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_googleRating_range_check"
  CHECK ("googleRating" IS NULL OR ("googleRating" >= 0 AND "googleRating" <= 5));

-- Separate the commercially sensitive batch acquisition record from ordinary
-- Lead source fields. This table is selected only by the dedicated OWNER-only
-- server service; no shared serializer, import-review projection, or audit
-- record includes these values.
CREATE TABLE "OwnerLeadAcquisitionProvenance" (
  "id" TEXT NOT NULL,
  "leadImportBatchId" TEXT NOT NULL,
  "sourceCode" TEXT NOT NULL,
  "acquisitionReference" TEXT NOT NULL,
  "providerName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OwnerLeadAcquisitionProvenance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OwnerLeadAcquisitionProvenance_leadImportBatchId_key"
  ON "OwnerLeadAcquisitionProvenance"("leadImportBatchId");

ALTER TABLE "OwnerLeadAcquisitionProvenance"
  ADD CONSTRAINT "OwnerLeadAcquisitionProvenance_leadImportBatchId_fkey"
  FOREIGN KEY ("leadImportBatchId") REFERENCES "LeadImportBatch"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- The signed row contract validates address/rating/timestamp/Maps URL before
-- staging. When the existing import workflow marks a row IMPORTED, mirror only
-- those validated sales-research fields into the Lead. No acquisition data is
-- present in the row payload or this trigger.
CREATE OR REPLACE FUNCTION "applyLeadImportResearchFields"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."status" = 'IMPORTED' AND NEW."createdLeadId" IS NOT NULL THEN
    UPDATE "Lead"
    SET
      "businessAddress" = NULLIF(NEW."payload" ->> 'businessAddress', ''),
      "googleRating" = CASE
        WHEN NEW."payload" ? 'googleRating'
          THEN (NEW."payload" ->> 'googleRating')::DECIMAL(2,1)
        ELSE NULL
      END,
      "googleRatingObservedAt" = CASE
        WHEN NEW."payload" ? 'googleRatingObservedAt'
          THEN timezone('UTC', (NEW."payload" ->> 'googleRatingObservedAt')::timestamptz)
        ELSE NULL
      END,
      "googleMapsUrl" = NULLIF(NEW."payload" ->> 'googleMapsUrl', '')
    WHERE "id" = NEW."createdLeadId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "LeadImportRow_applyResearchFields"
AFTER INSERT OR UPDATE OF "status", "createdLeadId", "payload" ON "LeadImportRow"
FOR EACH ROW EXECUTE FUNCTION "applyLeadImportResearchFields"();
