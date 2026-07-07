import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const loginForm = readFileSync(new URL("../src/app/(auth)/login/login-form.tsx", import.meta.url), "utf8");
const completionPage = readFileSync(new URL("../src/app/(auth)/login/complete/page.tsx", import.meta.url), "utf8");
const authConfig = readFileSync(new URL("../src/auth.config.ts", import.meta.url), "utf8");
const importPage = readFileSync(new URL("../src/app/admin/lead-imports/page.tsx", import.meta.url), "utf8");

assert.equal(loginForm.includes('window.location.replace("/login/complete")'), true);
assert.equal(loginForm.includes("recoverCompletedSession"), true);
assert.equal(loginForm.includes("getSession().catch(() => null)"), true);
assert.equal(loginForm.includes("SESSION_RECOVERY_ATTEMPTS"), true);
assert.equal(completionPage.includes('redirect(role && ADMIN_ROLES.has(role) ? "/admin" : "/portal")'), true);
assert.equal(authConfig.includes('pathname === "/login/complete"'), true);
assert.equal(authConfig.includes("if (!auth?.user?.id) return false;"), true);
assert.equal(authConfig.includes('if (pathname.startsWith("/admin")) return isAdmin(auth.user.role);'), true);
assert.equal(authConfig.includes('if (pathname.startsWith("/portal")) return auth.user.role === "AGENT" || isAdmin(auth.user.role);'), true);
assert.equal(importPage.includes('requireRole([...IMPORT_REVIEW_ROLES])'), true);
assert.equal(importPage.includes('"OWNER", "SUPER_ADMIN", "COMPLIANCE_MANAGER"'), true);
assert.equal(importPage.includes("payload: true"), false);
assert.equal(importPage.includes("leadImportBatch.create"), false);
assert.equal(importPage.includes("leadImportBatch.update"), false);
assert.equal(importPage.includes("leadImportRow.update"), false);

console.log("Login completion, route access, and read-only import review checks passed.");
