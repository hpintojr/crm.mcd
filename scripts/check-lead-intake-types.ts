import { strict as assert } from "node:assert";
import { leadIntakeMethods } from "../src/lib/lead-taxonomy";

assert.deepEqual(leadIntakeMethods, ["WEB_FORM_SUBMISSION", "DIRECT_MESSAGE", "MANUAL_ENTRY", "API_IMPORT", "REFERRAL_ENTRY"]);
console.log("Lead intake types passed.");
