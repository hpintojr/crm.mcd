import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./src/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((request) => {
  // Temporary Preview-only diagnostic. It contains no credentials, cookies, or
  // secrets; it only records the requested path and whether a session user was
  // available at the edge.
  console.info("[route-trace] middleware", {
    path: request.nextUrl.pathname,
    hasSessionUser: Boolean(request.auth?.user?.id),
  });

  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  return response;
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
