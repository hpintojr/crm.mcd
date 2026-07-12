import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { databaseErrorCode, databaseErrorName } from "@/lib/transient-database-retry";
import { signupSchema } from "@/lib/validation";
import { upsertSalesHqContact } from "@/lib/ghl";
import {
  isDuplicateAgentEmailError,
  MAX_PUBLIC_SIGNUP_BODY_BYTES,
  normalizePublicSignupInput,
} from "@/lib/public-signup-boundary";

export const dynamic = "force-dynamic";

const ACCEPTED_STATUS = 202;

function requestId(req: NextRequest) {
  const supplied = req.headers.get("x-request-id")?.trim();
  return supplied && supplied.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(supplied) ? supplied : randomUUID();
}

function json(body: unknown, status: number, id: string) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Request-Id": id,
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

function accepted(id: string) {
  return json({ ok: true }, ACCEPTED_STATUS, id);
}

function logDatabaseFailure(event: string, id: string, error: unknown, agentId?: string) {
  console.error(
    `[agent-signup] ${event}`,
    JSON.stringify({
      requestId: id,
      agentId: agentId ?? null,
      errorName: databaseErrorName(error),
      errorCode: databaseErrorCode(error),
    }),
  );
}

// Public endpoint: reserve one submitted Agent application, then port non-sensitive contact data to GHL.
// SSN, tax IDs, and bank details are intentionally NOT accepted here.
export async function POST(req: NextRequest) {
  const id = requestId(req);
  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PUBLIC_SIGNUP_BODY_BYTES) {
    return json({ error: "Request too large." }, 413, id);
  }

  let rawText: string;
  try {
    rawText = await req.text();
  } catch {
    return json({ error: "Unable to read request." }, 400, id);
  }

  if (new TextEncoder().encode(rawText).byteLength > MAX_PUBLIC_SIGNUP_BODY_BYTES) {
    return json({ error: "Request too large." }, 413, id);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch {
    return json({ error: "Invalid JSON" }, 400, id);
  }

  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    return json(
      { error: "Please check the highlighted fields.", issues: parsed.error.flatten() },
      422,
      id,
    );
  }

  const data = normalizePublicSignupInput(parsed.data);
  if (data.company_url) return accepted(id);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const companyName = data.companyName || null;

  let reservation: { agentId: string; auditId: string };
  try {
    reservation = await db.$transaction(async (tx) => {
      const agent = await tx.agent.create({
        data: {
          legalName: data.legalName,
          companyName,
          preferredName: data.preferredName || null,
          personalEmail: data.personalEmail,
          mobile: data.mobile,
          mailingAddress: data.mailingAddress || null,
          emergencyContact: data.emergencyContact || null,
          status: "SUBMITTED",
          onboardingDocs: {
            create: [
              { docType: "SALES_AGREEMENT" },
              { docType: "NDA_IP" },
              { docType: "W9_PAYOUT" },
              { docType: "ACKNOWLEDGMENT" },
            ],
          },
        },
        select: { id: true },
      });

      const audit = await tx.auditLog.create({
        data: {
          actionType: "AGENT_SIGNUP",
          entityType: "Agent",
          entityId: agent.id,
          ipAddress: ip,
          metadata: {
            requestId: id,
            companyNameProvided: Boolean(companyName),
            ghl: "pending",
          },
        },
        select: { id: true },
      });

      return { agentId: agent.id, auditId: audit.id };
    });
  } catch (error) {
    if (isDuplicateAgentEmailError(error)) {
      // Treat retries and concurrent duplicate submissions as idempotent success without revealing account existence.
      return accepted(id);
    }

    logDatabaseFailure("reservation failed", id, error);
    return json({ error: "Unable to submit application. Please try again." }, 500, id);
  }

  const ghl = await upsertSalesHqContact({
    legalName: data.legalName,
    companyName,
    preferredName: data.preferredName || null,
    personalEmail: data.personalEmail,
    mobile: data.mobile,
    mailingAddress: data.mailingAddress || null,
    tags: ["agent-signup"],
  });

  const ghlState = ghl.ok ? (ghl.stub ? "stub" : "linked") : "error";

  try {
    await db.$transaction(async (tx) => {
      if (ghl.ok) {
        await tx.agent.update({
          where: { id: reservation.agentId },
          data: { ghlContactId: ghl.data.contactId },
        });
      } else {
        await tx.integrationError.create({
          data: {
            source: "GHL_AGENT_SIGNUP",
            refId: reservation.agentId,
            message: "Agent signup contact sync failed.",
            payload: { operation: "contacts/upsert", requestId: id },
          },
        });
      }

      await tx.auditLog.update({
        where: { id: reservation.auditId },
        data: {
          metadata: {
            requestId: id,
            companyNameProvided: Boolean(companyName),
            ghl: ghlState,
          },
        },
      });
    });
  } catch (error) {
    // The application and initial audit are already durable. Do not invite a duplicate public retry.
    logDatabaseFailure("integration finalization failed", id, error, reservation.agentId);
  }

  if (!ghl.ok) {
    console.warn(
      "[agent-signup] GHL contact sync deferred",
      JSON.stringify({ requestId: id, agentId: reservation.agentId, operation: "contacts/upsert" }),
    );
  }

  return accepted(id);
}
