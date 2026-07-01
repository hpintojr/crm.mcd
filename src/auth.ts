import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authenticator } from "otplib";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

const credentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  totp: z.string().trim().regex(/^\d{6}$/).optional().or(z.literal("")),
});

class MfaRequiredError extends CredentialsSignin {
  code = "MFA_REQUIRED";
}

class MfaInvalidError extends CredentialsSignin {
  code = "MFA_INVALID";
}

class AccountLockedError extends CredentialsSignin {
  code = "ACCOUNT_LOCKED";
}

function requestIp(request: Request): string | null {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

async function auditMfaFailure(userId: string, role: string, ipAddress: string | null, reason: string) {
  await db.auditLog.create({
    data: {
      actorUserId: userId,
      actorRole: role,
      actionType: "LOGIN_FAILED",
      entityType: "User",
      entityId: userId,
      ipAddress,
      metadata: { reason },
    },
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totp: { label: "Authentication code", type: "text" },
      },
      async authorize(credentials, request) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password, totp } = parsed.data;
        const user = await db.user.findUnique({ where: { email } });
        if (!user || user.status !== "ACTIVE" || !user.passwordHash) return null;

        const ipAddress = requestIp(request);
        const now = new Date();
        if (user.lockedUntil && user.lockedUntil > now) {
          throw new AccountLockedError();
        }

        let passwordValid = false;
        try {
          passwordValid = await verifyPassword(user.passwordHash, password);
        } catch {
          passwordValid = false;
        }

        if (!passwordValid) {
          const failedLogins = user.failedLogins + 1;
          const lockedUntil =
            failedLogins >= MAX_FAILED_LOGINS
              ? new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000)
              : null;

          await db.$transaction([
            db.user.update({
              where: { id: user.id },
              data: { failedLogins, lockedUntil },
            }),
            db.auditLog.create({
              data: {
                actorUserId: user.id,
                actorRole: user.role,
                actionType: "LOGIN_FAILED",
                entityType: "User",
                entityId: user.id,
                ipAddress,
                metadata: { failedLogins },
              },
            }),
            ...(lockedUntil
              ? [
                  db.auditLog.create({
                    data: {
                      actorUserId: user.id,
                      actorRole: user.role,
                      actionType: "ACCOUNT_LOCKED",
                      entityType: "User",
                      entityId: user.id,
                      ipAddress,
                      metadata: { lockedUntil: lockedUntil.toISOString() },
                    },
                  }),
                ]
              : []),
          ]);
          return null;
        }

        if (user.mfaEnabled) {
          if (!totp) {
            await auditMfaFailure(user.id, user.role, ipAddress, "MFA_REQUIRED");
            throw new MfaRequiredError();
          }
          if (!user.totpSecret || !authenticator.check(totp, user.totpSecret)) {
            await auditMfaFailure(user.id, user.role, ipAddress, "MFA_INVALID");
            throw new MfaInvalidError();
          }
        }

        await db.$transaction([
          db.user.update({
            where: { id: user.id },
            data: {
              failedLogins: 0,
              lockedUntil: null,
              lastLoginAt: now,
            },
          }),
          db.auditLog.create({
            data: {
              actorUserId: user.id,
              actorRole: user.role,
              actionType: "LOGIN_SUCCESS",
              entityType: "User",
              entityId: user.id,
              ipAddress,
            },
          }),
        ]);

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          status: user.status,
          mfaEnabled: user.mfaEnabled,
        };
      },
    }),
  ],
  events: {
    async signOut(message) {
      if (!("token" in message) || !message.token) return;
      const userId = typeof message.token.id === "string" ? message.token.id : null;
      if (!userId) return;

      const user = await db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (!user) return;

      await db.auditLog.create({
        data: {
          actorUserId: userId,
          actorRole: user.role,
          actionType: "LOGOUT",
          entityType: "User",
          entityId: userId,
        },
      });
    },
  },
});
