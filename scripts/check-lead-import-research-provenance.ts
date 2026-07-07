import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { leadImportRowSchema } from "../src/lib/lead-taxonomy";
import { ownerLeadAcquisitionProvenanceInputSchema } from "../src/lib/lead-import-contract";

const validRow = {
  company: "Example Roofing",
  businessPhone: "555-010-1000",
  originalSource: "OTHER",
  sourceDetail: "LICENSED_PROVIDER_DATA",
  intakeMethod: "API_IMPORT",
  businessAddress: "101 Main Street",
  googleRating: 4.3,
  googleRatingObservedAt: "2026-07-07T19:00:00.000Z",
  googleMapsUrl: "https://maps.google.com/?q=Example+Roofing",
};

assert.equal(leadImportRowSchema.safeParse(validRow).success, true);
assert.equal(leadImportRowSchema.safeParse({ ...validRow, googleRating: 5.1 }).success, false);
assert.equal(leadImportRowSchema.safeParse({ ...validRow, googleRating: 4.25 }).success, false);
assert.equal(leadImportRowSchema.safeParse({ ...validRow, googleRatingObservedAt: undefined }).success, false);
assert.equal(leadImportRowSchema.safeParse({ ...validRow, googleMapsUrl: "not-a-url" }).success, false);

assert.equal(ownerLeadAcquisitionProvenanceInputSchema.safeParse({
  sourceCode: "RAW072026",
  acquisitionReference: "OP_ACQ_072026_001",
  providerName: "Licensed Provider",
}).success, true);
assert.equal(ownerLeadAcquisitionProvenanceInputSchema.safeParse({
  sourceCode: "RAW072026",
  acquisitionReference: "OP_ACQ_072026_001",
  unexpected: "must fail",
}).success, false);

const ownerService = readFileSync("src/lib/owner-lead-acquisition-provenance.ts", "utf8");
const ownerPage = readFileSync("src/app/admin/lead-imports/[batchId]/acquisition/page.tsx", "utf8");
const ownerRoute = readFileSync("src/app/api/lead-imports/[batchId]/owner-acquisition/route.ts", "utf8");
const taxonomy = readFileSync("src/lib/lead-taxonomy.ts", "utf8");
const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/20260707190000_lead_fields_owner_provenance/migration.sql", "utf8");

assert.match(ownerService, /requireRole\(\["OWNER"\]\)/);
assert.match(ownerService, /SELECT[\s\S]*"OwnerLeadAcquisitionProvenance"/);
assert.match(ownerService, /INSERT INTO "OwnerLeadAcquisitionProvenance"/);
assert.doesNotMatch(ownerPage, /from "@\/lib\/db"/);
assert.match(ownerPage, /readOwnerLeadAcquisitionProvenance/);
assert.match(ownerRoute, /guardLeadImportRequest/);
assert.match(ownerRoute, /ownerLeadAcquisitionProvenanceInputSchema/);
assert.doesNotMatch(ownerRoute, /providerName.*NextResponse/);
assert.doesNotMatch(taxonomy, /fetch\s*\(/);
assert.doesNotMatch(taxonomy, /googleapis\.com/);
assert.match(schema, /businessAddress\s+String\?/);
assert.match(schema, /googleRating\s+Decimal\?\s+@db\.Decimal\(2, 1\)/);
assert.match(schema, /googleRatingObservedAt\s+DateTime\?/);
assert.match(schema, /googleMapsUrl\s+String\?/);
assert.match(schema, /model OwnerLeadAcquisitionProvenance/);
assert.match(schema, /ownerAcquisitionProvenance\s+OwnerLeadAcquisitionProvenance\?/);
assert.equal(existsSync("prisma/schema.lead-research.patch"), false);
assert.match(migration, /CREATE TABLE "OwnerLeadAcquisitionProvenance"/);
assert.match(migration, /CREATE TRIGGER "LeadImportRow_applyResearchFields"/);
assert.match(migration, /"googleRating" DECIMAL\(2,1\)/);

console.log("Lead import research and provenance checks passed.");
