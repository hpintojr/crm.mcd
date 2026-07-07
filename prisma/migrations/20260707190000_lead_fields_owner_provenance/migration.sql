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
