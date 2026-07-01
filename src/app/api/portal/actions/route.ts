import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ ok: false, error: "Action handler is not enabled." }, { status: 404 });
}
