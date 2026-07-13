import { routeJsonResponse } from "@/lib/route-json-response";

export const dynamic = "force-dynamic";

export async function GET() {
  return routeJsonResponse(
    {
      ok: true,
      service: "crm-mcd",
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      git: {
        branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
        commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      },
    },
    { noindex: true },
  );
}
