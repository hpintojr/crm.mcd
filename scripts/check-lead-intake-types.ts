import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/lib/lead-taxonomy.ts", import.meta.url), "utf8");
const expected = 'export const leadIntakeMethods = ["WEB_FORM_SUBMISSION", "DIRECT_MESSAGE", "MANUAL_ENTRY", "API_IMPORT", "REFERRAL_ENTRY"] as const;';
assert.equal(source.includes(expected), true);

console.log("Lead intake types passed.");
