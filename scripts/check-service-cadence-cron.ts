import { strict as assert } from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { assessCadence, latestOf, nextCadenceDue, CADENCE_PERIOD_DAYS } from "../src/lib/service-cadence-schedule";

// Pure schedule math.
assert.deepEqual(CADENCE_PERIOD_DAYS, { WEEKLY: 7, BIWEEKLY: 14, MONTHLY: 30 }, "Cadence period days must match the servicing rules");

const anchor = new Date("2026-07-01T00:00:00.000Z");
assert.equal(nextCadenceDue(anchor, "WEEKLY").toISOString(), "2026-07-08T00:00:00.000Z");
assert.equal(nextCadenceDue(anchor, "BIWEEKLY").toISOString(), "2026-07-15T00:00:00.000Z");
assert.equal(nextCadenceDue(anchor, "MONTHLY").toISOString(), "2026-07-31T00:00:00.000Z");

assert.equal(assessCadence({ now: new Date("2026-07-07T23:59:59.000Z"), lastTouch: anchor, cadence: "WEEKLY" }).isDue, false, "One second before the weekly boundary must not be due");
assert.equal(assessCadence({ now: new Date("2026-07-08T00:00:00.000Z"), lastTouch: anchor, cadence: "WEEKLY" }).isDue, true, "The weekly boundary itself must be due");

const later = new Date("2026-07-10T00:00:00.000Z");
assert.equal(latestOf(anchor, null, later, undefined).toISOString(), later.toISOString(), "latestOf must pick the most recent non-null date");
assert.equal(latestOf(anchor, null, undefined).toISOString(), anchor.toISOString(), "latestOf must fall back to the first date");

// Route and wiring contracts.
const route = readFileSync("src/app/api/cron/servicing/cadence/route.ts", "utf8");
assert.ok(route.includes("if (!features.servicing)"), "Cadence cron must 404 while SERVICING_ENABLED is off");
assert.ok(route.includes("process.env.CRON_SECRET"), "Cadence cron must require CRON_SECRET authorization");
assert.ok(route.includes("runServiceCadenceSweep"), "Cadence cron must run the cadence sweep");
assert.ok(route.includes("readDryRun"), "Cadence cron must support dry runs");

const jobs = readFileSync("src/lib/service-cadence-jobs.ts", "utf8");
assert.ok(jobs.includes('requireFeature("servicing")'), "Sweep must require the servicing feature");
assert.ok(jobs.includes("openCadenceCaseCount"), "Sweep must dedupe on open cadence cases");
assert.ok(jobs.includes("requiredCadence"), "Sweep must use the roadmap-aligned requiredCadence rules");
assert.ok(jobs.includes("SERVICE_CADENCE"), "Sweep must open SERVICE_CADENCE cases");
assert.ok(!existsSync("src/lib/service-cadence.ts"), "Superseded duplicate cadence rules module must stay deleted");

const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
const paths = (vercel.crons ?? []).map((cron: { path: string }) => cron.path);
assert.ok(paths.includes("/api/cron/servicing/cadence"), "vercel.json must schedule the cadence cron");
assert.ok(paths.includes("/api/cron/leads/aging"), "Lead aging cron schedule must remain");

assert.ok(existsSync("prisma/migrations/20260715120000_add_service_cadence_trigger/migration.sql"), "SERVICE_CADENCE enum migration must be staged");

console.log("Service cadence cron checks passed.");
