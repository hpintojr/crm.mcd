import { NextRequest, NextResponse } from "next/server";
import { commitLeadImport } from "@/lib/lead-import-commit";

export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !Array.isArray((body as { rows?: unknown }).rows)) {
    return NextResponse.json({ error: "Provide an object containing a rows array." }, { status: 422 });
  }

  try {
    const result = await commitLeadImport((body as { rows: unknown[] }).rows);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Lead import failed." }, { status: 400 });
  }
}
