import { strict as assert } from "node:assert";
import { getLeadImportIntakePolicyViolation } from "../src/lib/lead-import-intake-policy";

assert.ok(getLeadImportIntakePolicyViolation("SCRAPE_IMPORT"));
assert.equal(getLeadImportIntakePolicyViolation("WEB_FORM_SUBMISSION"), null);
assert.equal(getLeadImportIntakePolicyViolation("MANUAL_ENTRY"), null);
assert.equal(getLeadImportIntakePolicyViolation("API_IMPORT"), null);

console.log("Lead intake policy checks passed.");
