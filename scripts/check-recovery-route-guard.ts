import { strict as assert } from "node:assert";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const leadsDirectory = join(process.cwd(), "src", "app", "admin", "leads");
const canonicalRouteDirectory = join(leadsDirectory, "[leadId]");
const retiredRouteDirectory = join(leadsDirectory, "[id]");

assert.equal(existsSync(canonicalRouteDirectory), true, "The canonical /admin/leads/[leadId] route must exist.");
assert.equal(existsSync(retiredRouteDirectory), false, "The retired /admin/leads/[id] route must not return.");

const dynamicDirectories = readdirSync(leadsDirectory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith("[") && entry.name.endsWith("]"))
  .map((entry) => entry.name)
  .sort();

assert.deepEqual(dynamicDirectories, ["[leadId]"], "Admin lead routes must expose one canonical dynamic segment.");
console.log("Recovery route guard passed.");
