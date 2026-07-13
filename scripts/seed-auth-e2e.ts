import { hash } from "@node-rs/argon2";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const db = new PrismaClient();
const LOCAL_DATABASE_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const OWNER_EMAIL = "e2e.owner@mercurycalldesk.test";
const AGENT_EMAIL = "e2e.agent@mercurycalldesk.test";

const inputSchema = z.object({
  ownerPassword: z.string().min(12),
  agentPassword: z.string().min(12),
});

const passwordOptions = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

function assertDisposableDatabase(name: "DATABASE_URL" | "DIRECT_URL") {
  const raw = process.env[name];
  if (!raw) throw new Error(`${name} is required for authenticated E2E seeding.`);

  const parsed = new URL(raw);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error(`${name} must use PostgreSQL.`);
  }
  if (!LOCAL_DATABASE_HOSTS.has(parsed.hostname)) {
    throw new Error(`${name} must target localhost for authenticated E2E tests.`);
  }
  if (!/(^|[_-])e2e($|[_-])/i.test(databaseName)) {
    throw new Error(`${name} database name must contain an isolated e2e token.`);
  }
}

async function main() {
  if (process.env.E2E_ALLOW_DISPOSABLE_DB !== "true") {
    throw new Error("E2E_ALLOW_DISPOSABLE_DB=true is required before synthetic auth data may be seeded.");
  }
  if (process.env.VERCEL_ENV) {
    throw new Error("Authenticated E2E seeding is forbidden in Vercel environments.");
  }
  assertDisposableDatabase("DATABASE_URL");
  assertDisposableDatabase("DIRECT_URL");

  const parsed = inputSchema.safeParse({
    ownerPassword: process.env.E2E_OWNER_PASSWORD,
    agentPassword: process.env.E2E_AGENT_PASSWORD,
  });
  if (!parsed.success) {
    throw new Error("Synthetic E2E passwords must be present and at least 12 characters.");
  }

  const [ownerPasswordHash, agentPasswordHash] = await Promise.all([
    hash(parsed.data.ownerPassword, passwordOptions),
    hash(parsed.data.agentPassword, passwordOptions),
  ]);

  const owner = await db.user.upsert({
    where: { email: OWNER_EMAIL },
    create: {
      email: OWNER_EMAIL,
      passwordHash: ownerPasswordHash,
      role: "OWNER",
      status: "ACTIVE",
      mfaEnabled: false,
    },
    update: {
      passwordHash: ownerPasswordHash,
      role: "OWNER",
      status: "ACTIVE",
      mfaEnabled: false,
      totpSecret: null,
      failedLogins: 0,
      lockedUntil: null,
    },
  });

  const agentUser = await db.user.upsert({
    where: { email: AGENT_EMAIL },
    create: {
      email: AGENT_EMAIL,
      passwordHash: agentPasswordHash,
      role: "AGENT",
      status: "ACTIVE",
      mfaEnabled: false,
    },
    update: {
      passwordHash: agentPasswordHash,
      role: "AGENT",
      status: "ACTIVE",
      mfaEnabled: false,
      totpSecret: null,
      failedLogins: 0,
      lockedUntil: null,
    },
  });

  const agent = await db.agent.upsert({
    where: { personalEmail: AGENT_EMAIL },
    create: {
      userId: agentUser.id,
      legalName: "Authenticated E2E Agent",
      preferredName: "E2E Agent",
      personalEmail: AGENT_EMAIL,
      mobile: "+15555550199",
      status: "ACTIVE",
      canClaimLeads: false,
      provisionedAt: new Date(),
    },
    update: {
      userId: agentUser.id,
      legalName: "Authenticated E2E Agent",
      preferredName: "E2E Agent",
      mobile: "+15555550199",
      status: "ACTIVE",
      canClaimLeads: false,
    },
  });

  console.log("Authenticated E2E users ready.", {
    ownerId: owner.id,
    agentUserId: agentUser.id,
    agentId: agent.id,
  });
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Unable to seed authenticated E2E users.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
