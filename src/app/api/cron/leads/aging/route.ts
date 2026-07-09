import { NextRequest, NextResponse } from "next/server";
import { runLeadAgingSweep } from "@/lib/lead-aging-jobs";
import { features } from "@/lib/features";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  return Boolean(cronSecret && header === `Bearer ${cronSecret}`);
}

function readDryRun(request: NextRequest) {
  const value = request.nextUrl.searchParams.get("dryRun")?.toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function readLimit(request: NextRequest) {
  const value = Number(request.nextUrl.searchParams.get("limit") ?? "");
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export async function GET(request: NextRequest) {
  if (!features.leads) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const result = await runLeadAgingSweep({ dryRun: readDryRun(request), limit: readLimit(request) });
  return NextResponse.json(result);
}
