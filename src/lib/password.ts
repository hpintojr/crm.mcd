import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { Algorithm, hash, verify } from "@node-rs/argon2";

const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, plain: string): Promise<boolean> {
  return verify(passwordHash, plain, ARGON2_OPTIONS);
}

/** Hashes a one-time token for storage. Raw token values are never persisted. */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** Generates a URL-safe 256-bit token for an activation or password-reset link. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}
