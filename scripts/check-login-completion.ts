import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const loginForm = readFileSync(new URL("../src/app/(auth)/login/login-form.tsx", import.meta.url), "utf8");

assert.equal(loginForm.includes('action="/api/auth/callback/credentials"'), true);
assert.equal(loginForm.includes('method="post"'), true);
assert.equal(loginForm.includes('name="csrfToken"'), true);
assert.equal(loginForm.includes('name="callbackUrl"'), true);
assert.equal(loginForm.includes('value="/admin"'), true);
assert.equal(loginForm.includes('fetch("/api/auth/csrf"'), true);
assert.equal(loginForm.includes('signIn("credentials"'), false);
assert.equal(loginForm.includes("useRouter"), false);

console.log("Native credentials-post login checks passed.");
