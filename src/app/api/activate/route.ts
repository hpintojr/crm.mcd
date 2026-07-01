import { NextRequest, NextResponse } from "next/server";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, hashToken } from "@/lib/password";

const passwordSchema = z.string().min(12, "Use at least 12 characters").max(256);
const requestSchema = z.object({
  action: z.enum(["prepare", "complete"]),
  token: z.string().min(1),
  password: passwordSchema,
  confirmPassword: z.string(),
  totpSecret: z.string().min(16).optional(),
  totp: z.string().regex(/^\d{6}$/).optional(),
});

function getIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

async function loadActivation(rawToken: string) {
  return db.activationToken.findFirst({
    where: {
      tokenHash: hashToken(rawToken),
      purpose: "ACTIVATION",
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });
}

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid activation request." }, { status: 422 });
  }

  const data = parsed.data;
  if (data.password !== data.confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 422 });
  }

  const activation = await loadActivation(data.token);
  if (!activation || activation.user.status === "DISABLED") {
    return NextResponse.json({ error: "This activation link is invalid or expired." }, { status: 400 });
  }

  const ipAddress = getIp(req);
  if (data.action === "prepare") {
    const totpSecret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(activation.user.email, "Mercury Call Desk", totpSecret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { width: 240, margin: 1 });

    await db.auditLog.create({
      data: {
        actorUserId: activation.userId,
        actorRole: activation.user.role,
        actionType: "ACTIVATION_STARTED",
        entityType: "User",
        entityId: activation.userId,
        ipAddress,
      },
    });

    return NextResponse.json({ ok: true, qrDataUrl, totpSecret, email: activation.user.email });
  }

  if (!data.totp || !data.totpSecret || !authenticator.check(data.totp, data.totpSecret)) {
    return NextResponse.json({ error: "That authentication code is not valid." }, { status: 422 });
  }

  const passwordHash = await hashPassword(data.password);
  await db.$transaction([
    db.user.update({
      where: { id: activation.userId },
      data: {
        passwordHash,
        status: "ACTIVE",
        totpSecret: data.totpSecret,
        mfaEnabled: true,
        failedLogins: 0,
        lockedUntil: null,
      },
    }),
    db.activationToken.update({
      where: { id: activation.id },
      data: { usedAt: new Date() },
    }),
    db.auditLog.create({
      data: {
        actorUserId: activation.userId,
        actorRole: activation.user.role,
        actionType: "MFA_ENROLLED",
        entityType: "User",
        entityId: activation.userId,
        ipAddress,
      },
    }),
    db.auditLog.create({
      data: {
        actorUserId: activation.userId,
        actorRole: activation.user.role,
        actionType: "ACTIVATION_COMPLETED",
        entityType: "User",
        entityId: activation.userId,
        ipAddress,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
