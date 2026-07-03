import { strict as assert } from "node:assert";
import { getLeadImportIntakePolicyViolation } from "../src/lib/lead-import-intake-policy";

assert.ok(getLeadImportIntakePolicyViolation({ originalSource: "OTHER", intakeMethod: "SCRAPE_IMPORT" }));
assert.equal(getLeadImportIntakePolicyViolation({ originalSource: "WEB_FORM", intakeMethod: "WEB_FORM_SUBMISSION" }), null);
assert.equal(getLeadImportIntakePolicyViolation({ originalSource: "OTHER", intakeMethod: "MANUAL_ENTRY" }), null);
assert.equal(getLeadImportIntakePolicyViolation({ originalSource: "OTHER", intakeMethod: "API_IMPORT" }), null);

console.log("Lead intake policy checks passed.");
