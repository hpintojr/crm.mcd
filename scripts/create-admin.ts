import { Algorithm, hash } from "@node-rs/argon2";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const db = new PrismaClient();

const inputSchema = z.object({
  email: z.string().trim().email("ADMIN_EMAIL must be a valid email"),
  password: z.string().min(12, "ADMIN_PASSWORD must be at least 12 characters"),
});

async function main() {
  const parsed = inputSchema.safeParse({
    email: process.argv[2] ?? process.env.ADMIN_EMAIL,
    password: process.argv[3] ?? process.env.ADMIN_PASSWORD,
  });

  if (!parsed.success) {
    console.error(parsed.error.issues.map((issue) => issue.message).join("\n"));
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hash(parsed.data.password, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  const user = await db.user.upsert({
    where: { email: parsed.data.email },
    create: {
      email: parsed.data.email,
      passwordHash,
      role: "OWNER",
      status: "ACTIVE",
      mfaEnabled: false,
    },
    update: {
      passwordHash,
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  await db.auditLog.create({
    data: {
      actorUserId: user.id,
      actorRole: "OWNER",
      actionType: "ADMIN_SEEDED",
      entityType: "User",
      entityId: user.id,
    },
  });

  console.log(`Owner account ready for ${user.email}. Enroll MFA before production use.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Unable to seed the owner account.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
