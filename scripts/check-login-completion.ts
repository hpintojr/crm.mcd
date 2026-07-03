import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const loginForm = readFileSync(new URL("../src/app/(auth)/login/login-form.tsx", import.meta.url), "utf8");

assert.equal(loginForm.includes('import { useRouter } from "next/navigation";'), true);
assert.equal(loginForm.includes("const router = useRouter();"), true);
assert.equal(loginForm.includes("const session = await getSession();"), true);
assert.equal(loginForm.includes('router.replace(role && ADMIN_ROLES.has(role) ? "/admin" : "/portal");'), true);
assert.equal(loginForm.includes("router.refresh();"), true);
assert.equal(loginForm.includes("recoverCompletedSession"), false);
assert.equal(loginForm.includes('window.location.replace("/login/complete")'), false);

console.log("Proven login flow checks passed.");
