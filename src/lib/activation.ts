import "server-only";

import { db } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/password";

const ACTIVATION_TTL_HOURS = 72;

export async function createActivation(userId: string) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + ACTIVATION_TTL_HOURS * 60 * 60 * 1000);

  await db.$transaction([
    db.activationToken.updateMany({
      where: { userId, purpose: "ACTIVATION", usedAt: null },
      data: { usedAt: new Date() },
    }),
    db.activationToken.create({
      data: {
        userId,
        purpose: "ACTIVATION",
        tokenHash: hashToken(token),
        expiresAt,
      },
    }),
  ]);

  const baseUrl = process.env.AUTH_URL ?? process.env.APP_URL ?? "http://localhost:3000";
  const url = new URL("/activate", baseUrl);
  url.searchParams.set("token", token);

  return { token, url: url.toString(), expiresAt };
}
