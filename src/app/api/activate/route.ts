import { NextRequest } from "next/server";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { hashPassword, hashToken } from "@/lib/password";
import { preparePublicJsonBody } from "@/lib/public-json-body-boundary";
import { routeJsonResponse, routeRequestId } from "@/lib/route-json-response";
import { databaseErrorCode, databaseErrorName } from "@/lib/transient-database-retry";
import {
  activationRequestSchema,
  ActivationUnavailableError,
  isActivationUnavailableError,
  MAX_ACTIVATION_BODY_BYTES,
} from "@/lib/account-activation-boundary";

export const dynamic = "force-dynamic";

function requestId(req: NextRequest) {
  return routeRequestId(req);
}

function json(body: unknown, status: number, id: string) {
  return routeJsonResponse(body, { status, requestId: id, noindex: true });
}

function unavailable(id: string) {
  return json({ error: "This activation link is invalid or expired." }, 400, id);
}

function getIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

function logFailure(event: string, id: string, error: unknown, userId?: string) {
  console.error(
    `[account-activation] ${event}`,
    JSON.stringify({
      requestId: id,
      userId: userId ?? null,
      errorName: databaseErrorName(error),
      errorCode: databaseErrorCode(error),
    }),
  );
}

async function loadActivation(rawToken: string) {
  return db.activationToken.findFirst({
    where: {
      tokenHash: hashToken(rawToken),
      purpose: "ACTIVATION",
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      userId: true,
      user: { select: { email: true, role: true, status: true } },
    },
  });
}

export async function POST(req: NextRequest) {
  const id = requestId(req);
  const prepared = await preparePublicJsonBody(req, {
    maxBodyBytes: MAX_ACTIVATION_BODY_BYTES,
    requestId: id,
  });
  if (!prepared.ok) return prepared.response;

  const parsed = activationRequestSchema.safeParse(prepared.body);
  if (!parsed.success) {
    return json({ error: "Invalid activation request." }, 422, id);
  }

  const data = parsed.data;
  if (data.password !== data.confirmPassword) {
    return json({ error: "Passwords do not match." }, 422, id);
  }

  let activation: Awaited<ReturnType<typeof loadActivation>>;
  try {
    activation = await loadActivation(data.token);
  } catch (error) {
    logFailure("lookup failed", id, error);
    return json({ error: "Unable to continue activation. Please try again." }, 500, id);
  }

  if (!activation || activation.user.status === "DISABLED") return unavailable(id);

  const ipAddress = getIp(req);
  if (data.action === "prepare") {
    try {
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
          metadata: { requestId: id },
        },
      });

      return json({ ok: true, qrDataUrl, totpSecret }, 200, id);
    } catch (error) {
      logFailure("preparation failed", id, error, activation.userId);
      return json({ error: "Unable to prepare activation. Please try again." }, 500, id);
    }
  }

  let validTotp = false;
  try {
    validTotp = authenticator.check(data.totp, data.totpSecret);
  } catch {
    validTotp = false;
  }
  if (!validTotp) return json({ error: "That authentication code is not valid." }, 422, id);

  let passwordHash: string;
  try {
    passwordHash = await hashPassword(data.password);
  } catch (error) {
    logFailure("password hashing failed", id, error, activation.userId);
    return json({ error: "Unable to complete activation. Please try again." }, 500, id);
  }

  try {
    await db.$transaction(async (tx) => {
      const now = new Date();
      const consumed = await tx.activationToken.updateMany({
        where: {
          id: activation.id,
          tokenHash: hashToken(data.token),
          purpose: "ACTIVATION",
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) throw new ActivationUnavailableError();

      const currentUser = await tx.user.findUnique({
        where: { id: activation.userId },
        select: { id: true, role: true, status: true },
      });
      if (!currentUser || currentUser.status === "DISABLED") throw new ActivationUnavailableError();

      await tx.user.update({
        where: { id: currentUser.id },
        data: {
          passwordHash,
          status: "ACTIVE",
          totpSecret: data.totpSecret,
          mfaEnabled: true,
          failedLogins: 0,
          lockedUntil: null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: currentUser.id,
          actorRole: currentUser.role,
          actionType: "MFA_ENROLLED",
          entityType: "User",
          entityId: currentUser.id,
          ipAddress,
          metadata: { requestId: id },
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: currentUser.id,
          actorRole: currentUser.role,
          actionType: "ACTIVATION_COMPLETED",
          entityType: "User",
          entityId: currentUser.id,
          ipAddress,
          metadata: { requestId: id },
        },
      });
    });
  } catch (error) {
    if (isActivationUnavailableError(error)) return unavailable(id);
    logFailure("completion failed", id, error, activation.userId);
    return json({ error: "Unable to complete activation. Please try again." }, 500, id);
  }

  return json({ ok: true }, 200, id);
}
