import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";

const instrumentation = readFileSync("instrumentation.ts", "utf8");
assert.ok(instrumentation.includes("process.env.SENTRY_DSN"), "Instrumentation must gate initialization on SENTRY_DSN");
assert.ok(instrumentation.includes("export async function register"), "Instrumentation must export register()");
assert.ok(instrumentation.includes("export const onRequestError"), "Instrumentation must export onRequestError");
assert.ok(instrumentation.includes("sendDefaultPii: false"), "Instrumentation must disable default PII");
assert.ok(instrumentation.includes("tracesSampleRate: 0"), "Instrumentation must not enable tracing");
assert.ok(!instrumentation.includes("NEXT_PUBLIC"), "Error tracking is server-only; no public env values");

const tracker = readFileSync("src/lib/error-tracking.ts", "utf8");
assert.ok(tracker.includes('import "server-only"'), "Error tracking helper must be server-only");
assert.ok(tracker.includes("sentryConfigured"), "Error tracking helper must no-op without a DSN");
assert.ok(!tracker.includes("payload"), "Error tracking helper must never forward stored JSON bodies");

const webhookLib = readFileSync("src/lib/ghl-webhook.ts", "utf8");
assert.ok(webhookLib.includes("captureIntegrationError(input.source, input.message, input.refId ?? null)"), "logIntegrationError must forward source/message/refId only");

const envLib = readFileSync("src/lib/env.ts", "utf8");
assert.ok(envLib.includes("export const sentryConfigured"), "env must expose sentryConfigured");

const envExample = readFileSync(".env.example", "utf8");
assert.ok(envExample.includes('SENTRY_DSN=""'), ".env.example must document SENTRY_DSN as empty (disabled)");
assert.ok(!/https:\/\/[0-9a-f]{8,}@/i.test(envExample), "No DSN value may be committed");

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
assert.ok(pkg.dependencies["@sentry/nextjs"], "@sentry/nextjs must be a dependency");

for (const forbidden of ["sentry.client.config.ts", "sentry.client.config.js", "instrumentation-client.ts", "src/instrumentation-client.ts"]) {
  assert.ok(!existsSync(forbidden), `Server-only boundary: ${forbidden} must not exist`);
}

console.log("Error tracking boundary checks passed.");
