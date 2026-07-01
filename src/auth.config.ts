import type { NextAuthConfig } from "next-auth";

const ADMIN_ROLES = ["OWNER", "SUPER_ADMIN", "SALES_MANAGER", "COMPLIANCE_MANAGER", "FINANCE_MANAGER"] as const;

const isAdmin = (role: string | undefined) => ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number]);

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const pathname = nextUrl.pathname;
      const isPublic = pathname === "/" || pathname === "/login" || pathname === "/signup" || pathname === "/activate" || pathname.startsWith("/api/auth") || pathname === "/api/signup" || pathname === "/api/activate";
      if (isPublic) return true;
      if (!auth?.user?.id) return false;
      if (pathname.startsWith("/admin")) return isAdmin(auth.user.role);
      if (pathname.startsWith("/portal")) return auth.user.role === "AGENT" || isAdmin(auth.user.role);
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.status = user.status;
        token.mfaEnabled = user.mfaEnabled;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? token.sub ?? "";
        session.user.role = token.role ?? "AGENT";
        session.user.status = token.status ?? "INVITED";
        session.user.mfaEnabled = token.mfaEnabled ?? false;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
