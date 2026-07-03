import { redirect } from "next/navigation";
import { auth } from "@/auth";

const ADMIN_ROLES = new Set([
  "OWNER",
  "SUPER_ADMIN",
  "SALES_MANAGER",
  "COMPLIANCE_MANAGER",
  "FINANCE_MANAGER",
]);

/**
 * Completes the credentials/MFA handoff on the server after Auth.js writes the
 * session cookie. Keeping the role decision here avoids relying on an
 * immediately refreshed browser session after sign-in.
 */
export default async function LoginCompletePage() {
  const session = await auth();
  const userId = session?.user?.id;
  const role = session?.user?.role;

  if (!userId) redirect("/login?e=session");
  redirect(role && ADMIN_ROLES.has(role) ? "/admin" : "/portal");
}
