-- Lead import taxonomy: original source, intake method, referrer/UTM lineage,
-- and website-opportunity fields, matching src/lib/lead-taxonomy.ts.
-- Purely additive: existing columns are untouched, all new columns are
-- nullable or backed by a default, so this is safe to run against live data.
-- Apply only through the controlled Neon migration process (Hamilton/CI), not
-- automatically. LEADS_ENABLED continues to gate exposure at the app layer.

CREATE TYPE "LeadOriginalSource" AS ENUM ('GOOGLE_MAPS','INSTAGRAM','REFERRAL','PPC','EMAIL','SMS','LINKEDIN','WEB_FORM','FACEBOOK','OTHER');
CREATE TYPE "LeadIntakeMethod" AS ENUM ('SCRAPE_IMPORT','WEB_FORM_SUBMISSION','DIRECT_MESSAGE','MANUAL_ENTRY','API_IMPORT','REFERRAL_ENTRY');
CREATE TYPE "LeadReferrerType" AS ENUM ('CUSTOMER','PARTNER','AGENT','EMPLOYEE','VENDOR','OTHER');
CREATE TYPE "WebsiteStatus" AS ENUM ('UNKNOWN','LISTED','NO_WEBSITE_LISTED','VERIFIED_NO_WEBSITE','NEEDS_REVIEW');
CREATE TYPE "WebsiteOpportunityStatus" AS ENUM ('NOT_EVALUATED','ELIGIBLE_REVIEW','BUNDLE_OFFERED','WEBSITE_ONLY_QUOTE','WEBSITE_ONLY_WON','DECLINED','NOT_ELIGIBLE');
CREATE TYPE "WebsiteOfferTrack" AS ENUM ('BUNDLE_INCENTIVE','WEBSITE_ONLY');

ALTER TABLE "Lead"
  ADD COLUMN "originalSource" "LeadOriginalSource",
  ADD COLUMN "sourceDetail" TEXT,
  ADD COLUMN "sourceRecordUrl" TEXT,
  ADD COLUMN "campaignName" TEXT,
  ADD COLUMN "campaignExternalId" TEXT,
  ADD COLUMN "intakeMethod" "LeadIntakeMethod",
  ADD COLUMN "referrerName" TEXT,
  ADD COLUMN "referrerType" "LeadReferrerType",
  ADD COLUMN "referrerLeadId" TEXT,
  ADD COLUMN "utmSource" TEXT,
  ADD COLUMN "utmMedium" TEXT,
  ADD COLUMN "utmCampaign" TEXT,
  ADD COLUMN "utmContent" TEXT,
  ADD COLUMN "utmTerm" TEXT,
  ADD COLUMN "websiteStatus" "WebsiteStatus" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "websiteReviewedAt" TIMESTAMP(3),
  ADD COLUMN "websiteReviewNote" TEXT,
  ADD COLUMN "websiteOpportunityStatus" "WebsiteOpportunityStatus" NOT NULL DEFAULT 'NOT_EVALUATED',
  ADD COLUMN "websiteOfferTrack" "WebsiteOfferTrack",
  ADD COLUMN "websiteQuotedAmountCents" INTEGER,
  ADD COLUMN "websiteQuoteExpiresAt" TIMESTAMP(3),
  ADD COLUMN "websiteScopeNote" TEXT,
  ADD COLUMN "dedupeKey" TEXT;

CREATE UNIQUE INDEX "Lead_dedupeKey_key" ON "Lead"("dedupeKey");
CREATE INDEX "Lead_originalSource_idx" ON "Lead"("originalSource");
CREATE INDEX "Lead_websiteStatus_idx" ON "Lead"("websiteStatus");
CREATE INDEX "Lead_websiteOpportunityStatus_idx" ON "Lead"("websiteOpportunityStatus");
CREATE INDEX "Lead_campaignExternalId_idx" ON "Lead"("campaignExternalId");
