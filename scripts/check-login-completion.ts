import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const loginForm = readFileSync(new URL("../src/app/(auth)/login/login-form.tsx", import.meta.url), "utf8");
const loginPage = readFileSync(new URL("../src/app/(auth)/login/page.tsx", import.meta.url), "utf8");
const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");

assert.equal(loginForm.includes('action="/api/auth/callback/credentials"'), true);
assert.equal(loginForm.includes('method="post"'), true);
assert.equal(loginForm.includes('name="csrfToken"'), true);
assert.equal(loginForm.includes('name="callbackUrl"'), true);
assert.equal(loginForm.includes('value="/admin"'), true);
assert.equal(loginForm.includes('fetch("/api/auth/csrf"'), true);
assert.equal(loginForm.includes('requiresMfa && ('), true);
assert.equal(loginForm.includes('signIn("credentials"'), false);
assert.equal(loginForm.includes("useRouter"), false);
assert.equal(loginPage.includes('searchParams.code === "MFA_REQUIRED"'), true);
assert.equal(loginPage.includes('requiresMfa: true'), true);
assert.equal(middleware.includes('matcher: ["/admin/:path*", "/portal/:path*"]'), true);
assert.equal(middleware.includes('"/((?!api|_next/static|_next/image|favicon.ico).*)"'), false);

console.log("Native two-step credentials login checks passed.");
