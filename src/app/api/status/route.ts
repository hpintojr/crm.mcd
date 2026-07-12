import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "crm-mcd",
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      git: {
        branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
        commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    },
  );
}
