import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const ACTIVATION_TTL_HOURS = 72;

function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function main() {
  const email = process.env.BOOTSTRAP_OWNER_EMAIL?.trim().toLowerCase();
  const rawToken = process.env.BOOTSTRAP_OWNER_TOKEN?.trim();

  // This script does nothing on normal builds unless both bootstrap values exist.
  if (!email && !rawToken) {
    console.log("No owner bootstrap requested.");
    return;
  }

  if (!email || !rawToken) {
    throw new Error(
      "BOOTSTRAP_OWNER_EMAIL and BOOTSTRAP_OWNER_TOKEN must both be set.",
    );
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("BOOTSTRAP_OWNER_EMAIL is not a valid email address.");
  }

  if (rawToken.length < 32) {
    throw new Error(
      "BOOTSTRAP_OWNER_TOKEN must be at least 32 random characters.",
    );
  }

  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + ACTIVATION_TTL_HOURS * 60 * 60 * 1000,
  );

  await db.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { email },
    });

    if (existingUser?.status === "ACTIVE") {
      console.log("Owner account is already active. Skipping bootstrap.");
      return;
    }

    if (existingUser && existingUser.role !== "OWNER") {
      throw new Error(
        "This email already belongs to a non-owner account.",
      );
    }

    const user =
      existingUser ??
      (await tx.user.create({
        data: {
          email,
          role: "OWNER",
          status: "INVITED",
        },
      }));

    const matchingToken = await tx.activationToken.findUnique({
      where: { tokenHash },
    });

    if (matchingToken && matchingToken.userId !== user.id) {
      throw new Error(
        "This bootstrap token is already attached to another account.",
      );
    }

    await tx.activationToken.updateMany({
      where: {
        userId: user.id,
        purpose: "ACTIVATION",
        usedAt: null,
        tokenHash: { not: tokenHash },
      },
      data: {
        usedAt: new Date(),
      },
    });

    if (matchingToken) {
      await tx.activationToken.update({
        where: { tokenHash },
        data: {
          purpose: "ACTIVATION",
          expiresAt,
          usedAt: null,
        },
      });
    } else {
      await tx.activationToken.create({
        data: {
          userId: user.id,
          tokenHash,
          purpose: "ACTIVATION",
          expiresAt,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        actorRole: "OWNER",
        actionType: "OWNER_BOOTSTRAP_INVITED",
        entityType: "User",
        entityId: user.id,
        metadata: {
          invitedEmail: email,
          mfaRequired: true,
        },
      },
    });
  });

  console.log(
    "Owner invitation created. Complete activation, then remove the bootstrap environment variables.",
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Owner bootstrap failed.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });