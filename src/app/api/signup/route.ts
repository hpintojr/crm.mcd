import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signupSchema } from "@/lib/validation";
import { upsertSalesHqContact } from "@/lib/ghl";

// Public endpoint: create a submitted agent and port non-sensitive contact data to GHL.
// SSN and bank details are intentionally NOT accepted here.
export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the highlighted fields.", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const data = parsed.data;

  if (data.company_url) return NextResponse.json({ ok: true }, { status: 200 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const existing = await db.agent.findUnique({ where: { personalEmail: data.personalEmail } });
  if (existing) {
    return NextResponse.json({ error: "An application with this email already exists." }, { status: 409 });
  }

  const companyName = data.companyName.trim() || null;
  const ghl = await upsertSalesHqContact({
    legalName: data.legalName,
    companyName,
    preferredName: data.preferredName || null,
    personalEmail: data.personalEmail,
    mobile: data.mobile,
    mailingAddress: data.mailingAddress || null,
    tags: ["agent-signup"],
  });

  const agent = await db.agent.create({
    data: {
      legalName: data.legalName,
      companyName,
      preferredName: data.preferredName || null,
      personalEmail: data.personalEmail,
      mobile: data.mobile,
      mailingAddress: data.mailingAddress || null,
      emergencyContact: data.emergencyContact || null,
      status: "SUBMITTED",
      ghlContactId: ghl.ok ? ghl.data.contactId : null,
      onboardingDocs: {
        create: [
          { docType: "SALES_AGREEMENT" },
          { docType: "NDA_IP" },
          { docType: "W9_PAYOUT" },
          { docType: "ACKNOWLEDGMENT" },
        ],
      },
    },
  });

  await db.auditLog.create({
    data: {
      actionType: "AGENT_SIGNUP",
      entityType: "Agent",
      entityId: agent.id,
      ipAddress: ip,
      metadata: {
        companyNameProvided: Boolean(companyName),
        ghl: ghl.ok ? (ghl.stub ? "stub" : "linked") : "error",
        ghlError: ghl.ok ? null : ghl.error,
      },
    },
  });

  return NextResponse.json(
    { ok: true, agentId: agent.id, ghl: ghl.ok ? (ghl.stub ? "stub" : "linked") : "error" },
    { status: 201 },
  );
}
