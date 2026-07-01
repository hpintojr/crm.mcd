import { NextRequest, NextResponse } from "next/server";

export async function POST(_req: NextRequest) {
  return NextResponse.json({ error: "Activation setup is not complete." }, { status: 503 });
}
