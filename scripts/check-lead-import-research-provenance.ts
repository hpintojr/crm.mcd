import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { ownerLeadAcquisitionProvenanceInputSchema } from "../src/lib/lead-import-contract";

assert.equal(ownerLeadAcquisitionProvenanceInputSchema.safeParse({
  sourceCode: "OWNER_SOURCE_FIXTURE",
  acquisitionReference: "OWNER_REFERENCE_FIXTURE",
}).success, true);
assert.equal(ownerLeadAcquisitionProvenanceInputSchema.safeParse({
  sourceCode: "OWNER_SOURCE_FIXTURE",
  acquisitionReference: "OWNER_REFERENCE_FIXTURE",
  providerName: "must fail",
}).success, false);
assert.equal(ownerLeadAcquisitionProvenanceInputSchema.safeParse({
  sourceCode: "OWNER_SOURCE_FIXTURE",
  acquisitionReference: "OWNER_REFERENCE_FIXTURE",
  unexpected: "must fail",
}).success, false);

const ownerService = readFileSync("src/lib/owner-lead-acquisition-provenance.ts", "utf8");
const ownerPage = readFileSync("src/app/admin/lead-imports/[batchId]/acquisition/page.tsx", "utf8");
const ownerRoute = readFileSync("src/app/api/lead-imports/[batchId]/owner-acquisition/route.ts", "utf8");
const taxonomy = readFileSync("src/lib/lead-taxonomy.ts", "utf8");
const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/20260707190000_lead_fields_owner_provenance/migration.sql", "utf8");
const batchService = readFileSync("src/lib/lead-import-batch.ts", "utf8");
const importList = readFileSync("src/app/admin/lead-imports/page.tsx", "utf8");
const importDetail = readFileSync("src/app/admin/lead-imports/[batchId]/page.tsx", "utf8");
const agentLeadPage = readFileSync("src/app/portal/leads/page.tsx", "utf8");
const adminLeadPage = readFileSync("src/app/admin/leads/[leadId]/page.tsx", "utf8");

assert.match(taxonomy, /businessAddress: z\.string\(\)\.trim\(\)\.max\(500\)\.optional\(\)/);
assert.match(taxonomy, /googleRating: z\.number\(\)\.finite\(\)\.min\(0\)\.max\(5\)\.optional\(\)/);
assert.match(taxonomy, /googleRatingObservedAt: z\.string\(\)\.datetime\(\{ offset: true \}\)\.optional\(\)/);
assert.match(taxonomy, /googleMapsUrl: z\.string\(\)\.trim\(\)\.url\(\)\.max\(2000\)\.optional\(\)/);
assert.match(taxonomy, /Google rating must use one decimal place or fewer/);
assert.match(taxonomy, /A provider-observed timestamp is required when a Google rating is supplied/);
assert.doesNotMatch(taxonomy, /fetch\s*\(/);
assert.doesNotMatch(taxonomy, /googleapis\.com/);

assert.match(ownerService, /requireRole\(\["OWNER"\]\)/);
assert.match(ownerService, /SELECT[\s\S]*"OwnerLeadAcquisitionProvenance"/);
assert.match(ownerService, /INSERT INTO "OwnerLeadAcquisitionProvenance"/);
assert.match(ownerService, /batch\.status !== "DRAFT"/);
assert.doesNotMatch(ownerService, /providerName/);
assert.doesNotMatch(ownerPage, /from "@\/lib\/db"/);
assert.match(ownerPage, /readOwnerLeadAcquisitionProvenance/);
assert.doesNotMatch(ownerPage, /Provider/);
assert.match(ownerRoute, /guardLeadImportRequest/);
assert.match(ownerRoute, /ownerLeadAcquisitionProvenanceInputSchema/);
assert.match(ownerRoute, /LEAD_IMPORT_INVALID_STATE/);
assert.doesNotMatch(ownerRoute, /providerName.*NextResponse/);

for (const sharedSurface of [batchService, importList, importDetail, agentLeadPage, adminLeadPage]) {
  assert.doesNotMatch(sharedSurface, /ownerAcquisitionProvenance/);
  assert.doesNotMatch(sharedSurface, /OwnerLeadAcquisitionProvenance/);
}
assert.doesNotMatch(batchService, /sourceCode/);
assert.doesNotMatch(batchService, /acquisitionReference/);

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
