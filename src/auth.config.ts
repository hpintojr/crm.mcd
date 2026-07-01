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
        const id = typeof token.id === "string" ? token.id : typeof token.sub === "string" ? token.sub : "";
        const role = typeof token.role === "string" ? token.role : "AGENT";
        const status = typeof token.status === "string" ? token.status : "INVITED";
        const mfaEnabled = token.mfaEnabled === true;

        session.user.id = id;
        session.user.role = role as typeof session.user.role;
        session.user.status = status as typeof session.user.status;
        session.user.mfaEnabled = mfaEnabled;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
