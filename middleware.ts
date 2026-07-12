import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./src/auth.config";

const { auth } = NextAuth(authConfig);

export default auth(() => NextResponse.next());

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
