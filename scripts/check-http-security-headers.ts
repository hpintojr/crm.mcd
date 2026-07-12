import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertContains(path: string, expected: string) {
  const content = readFileSync(path, "utf8");
  assert(content.includes(expected), `${path} is missing required HTTP security contract: ${expected}`);
}

function assertExcludes(path: string, forbidden: string) {
  const content = readFileSync(path, "utf8");
  assert(!content.includes(forbidden), `${path} contains forbidden HTTP security configuration: ${forbidden}`);
}

const configPath = "next.config.mjs";
const middlewarePath = "middleware.ts";
const smokePath = "scripts/run-production-smoke.ts";

for (const expected of [
  'poweredByHeader: false',
  'source: "/:path*"',
  'key: "Content-Security-Policy"',
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  'key: "X-Content-Type-Options", value: "nosniff"',
  'key: "X-Frame-Options", value: "DENY"',
  'key: "Referrer-Policy", value: "strict-origin-when-cross-origin"',
  'key: "Permissions-Policy"',
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "browsing-topics=()",
  'key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups"',
  'key: "X-DNS-Prefetch-Control", value: "off"',
  'key: "X-Permitted-Cross-Domain-Policies", value: "none"',
  'key: "X-Download-Options", value: "noopen"',
]) {
  assertContains(configPath, expected);
}

for (const forbidden of [
  "unsafe-inline",
  "unsafe-eval",
  "Access-Control-Allow-Origin",
  "Cross-Origin-Embedder-Policy",
  "default-src *",
  "frame-ancestors *",
]) {
  assertExcludes(configPath, forbidden);
}

for (const expected of [
  'import NextAuth from "next-auth"',
  'import { authConfig } from "./src/auth.config"',
  "const { auth } = NextAuth(authConfig)",
  "export default auth(() => NextResponse.next())",
  'matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]',
]) {
  assertContains(middlewarePath, expected);
}

for (const forbidden of [
  "response.headers.set",
  "Content-Security-Policy",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "Cross-Origin-Opener-Policy",
  "X-DNS-Prefetch-Control",
  "X-Permitted-Cross-Domain-Policies",
  "X-Download-Options",
]) {
  assertExcludes(middlewarePath, forbidden);
}

for (const expected of [
  "validateSecurityHeaders",
  'response.headers.get("content-security-policy")',
  'response.headers.get("x-powered-by") === null',
  'response.headers.get("x-content-type-options") === "nosniff"',
  'response.headers.get("x-frame-options") === "DENY"',
  'response.headers.get("referrer-policy") === "strict-origin-when-cross-origin"',
  'response.headers.get("cross-origin-opener-policy") === "same-origin-allow-popups"',
  'response.headers.get("x-dns-prefetch-control") === "off"',
  'response.headers.get("x-permitted-cross-domain-policies") === "none"',
  'response.headers.get("x-download-options") === "noopen"',
  "Strict-Transport-Security",
]) {
  assertContains(smokePath, expected);
}

assertContains("docs/HTTP_SECURITY_HEADERS.md", "Conservative Content Security Policy");
assertContains("docs/HTTP_SECURITY_HEADERS.md", "Single source of truth");
assertContains("docs/HTTP_SECURITY_HEADERS.md", "X-Powered-By");
assertContains("docs/HTTP_SECURITY_HEADERS.md", "Production Smoke");
assertContains("docs/INDEX.md", "HTTP_SECURITY_HEADERS.md");
assertContains("README.md", "HTTP security headers");
assertContains("package.json", '"check:http-security-headers": "tsx scripts/check-http-security-headers.ts"');
assertContains("package.json", "check-http-security-headers.ts");
assertContains("src/lib/lead-deployment-verification.ts", "HTTP security headers guard passed.");
assertContains("scripts/check-deployment-verification-guard.ts", "HTTP security headers guard passed.");

console.log("HTTP security headers guard passed.");
