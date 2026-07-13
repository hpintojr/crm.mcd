import { hash } from "@node-rs/argon2";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const db = new PrismaClient();
const LOCAL_DATABASE_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const OWNER_EMAIL = "e2e.owner@mercurycalldesk.test";
const AGENT_EMAIL = "e2e.agent@mercurycalldesk.test";
const MFA_EMAIL = "e2e.mfa@mercurycalldesk.test";
const LOCKOUT_EMAIL = "e2e.lockout@mercurycalldesk.test";
const LOCKOUT_RECOVERY_EMAIL = "e2e.lockout-recovery@mercurycalldesk.test";
const DISABLED_EMAIL = "e2e.disabled@mercurycalldesk.test";
const SUSPENDED_SESSION_EMAIL = "e2e.suspended-session@mercurycalldesk.test";
const ROLE_CHANGE_EMAIL = "e2e.role-change@mercurycalldesk.test";

const inputSchema = z.object({
  ownerPassword: z.string().min(12),
  agentPassword: z.string().min(12),
  mfaPassword: z.string().min(12),
  lockoutPassword: z.string().min(12),
  lockoutRecoveryPassword: z.string().min(12),
  disabledPassword: z.string().min(12),
  suspendedSessionPassword: z.string().min(12),
  roleChangePassword: z.string().min(12),
  mfaTotpSecret: z.string().regex(/^[A-Z2-7]{16,}$/),
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

async function upsertSyntheticUser(input: {
  email: string;
  passwordHash: string;
  role: "OWNER" | "AGENT";
  status?: "ACTIVE" | "DISABLED";
  mfaEnabled: boolean;
  totpSecret?: string | null;
}) {
  return db.user.upsert({
    where: { email: input.email },
    create: {
      email: input.email,
      passwordHash: input.passwordHash,
      role: input.role,
      status: input.status ?? "ACTIVE",
      mfaEnabled: input.mfaEnabled,
      totpSecret: input.totpSecret ?? null,
    },
    update: {
      passwordHash: input.passwordHash,
      role: input.role,
      status: input.status ?? "ACTIVE",
      mfaEnabled: input.mfaEnabled,
      totpSecret: input.totpSecret ?? null,
      failedLogins: 0,
      lockedUntil: null,
    },
  });
}

async function upsertSyntheticAgentProfile(input: {
  userId: string;
  email: string;
  legalName: string;
  preferredName: string;
  mobile: string;
}) {
  return db.agent.upsert({
    where: { personalEmail: input.email },
    create: {
      userId: input.userId,
      legalName: input.legalName,
      preferredName: input.preferredName,
      personalEmail: input.email,
      mobile: input.mobile,
      status: "ACTIVE",
      canClaimLeads: false,
      provisionedAt: new Date(),
    },
    update: {
      userId: input.userId,
      legalName: input.legalName,
      preferredName: input.preferredName,
      mobile: input.mobile,
      status: "ACTIVE",
      canClaimLeads: false,
    },
  });
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
    mfaPassword: process.env.E2E_MFA_PASSWORD,
    lockoutPassword: process.env.E2E_LOCKOUT_PASSWORD,
    lockoutRecoveryPassword: process.env.E2E_LOCKOUT_RECOVERY_PASSWORD,
    disabledPassword: process.env.E2E_DISABLED_PASSWORD,
    suspendedSessionPassword: process.env.E2E_SUSPENDED_SESSION_PASSWORD,
    roleChangePassword: process.env.E2E_ROLE_CHANGE_PASSWORD,
    mfaTotpSecret: process.env.E2E_MFA_TOTP_SECRET,
  });
  if (!parsed.success) {
    throw new Error("Synthetic E2E passwords and the Base32 MFA secret must satisfy the test-only contract.");
  }

  const [
    ownerPasswordHash,
    agentPasswordHash,
    mfaPasswordHash,
    lockoutPasswordHash,
    lockoutRecoveryPasswordHash,
    disabledPasswordHash,
    suspendedSessionPasswordHash,
    roleChangePasswordHash,
  ] = await Promise.all([
    hash(parsed.data.ownerPassword, passwordOptions),
    hash(parsed.data.agentPassword, passwordOptions),
    hash(parsed.data.mfaPassword, passwordOptions),
    hash(parsed.data.lockoutPassword, passwordOptions),
    hash(parsed.data.lockoutRecoveryPassword, passwordOptions),
    hash(parsed.data.disabledPassword, passwordOptions),
    hash(parsed.data.suspendedSessionPassword, passwordOptions),
    hash(parsed.data.roleChangePassword, passwordOptions),
  ]);

  const [owner, agentUser, mfaUser, lockoutUser, lockoutRecoveryUser, disabledUser, suspendedSessionUser, roleChangeUser] = await Promise.all([
    upsertSyntheticUser({
      email: OWNER_EMAIL,
      passwordHash: ownerPasswordHash,
      role: "OWNER",
      mfaEnabled: false,
    }),
    upsertSyntheticUser({
      email: AGENT_EMAIL,
      passwordHash: agentPasswordHash,
      role: "AGENT",
      mfaEnabled: false,
    }),
    upsertSyntheticUser({
      email: MFA_EMAIL,
      passwordHash: mfaPasswordHash,
      role: "OWNER",
      mfaEnabled: true,
      totpSecret: parsed.data.mfaTotpSecret,
    }),
    upsertSyntheticUser({
      email: LOCKOUT_EMAIL,
      passwordHash: lockoutPasswordHash,
      role: "AGENT",
      mfaEnabled: false,
    }),
    upsertSyntheticUser({
      email: LOCKOUT_RECOVERY_EMAIL,
      passwordHash: lockoutRecoveryPasswordHash,
      role: "OWNER",
      mfaEnabled: false,
    }),
    upsertSyntheticUser({
      email: DISABLED_EMAIL,
      passwordHash: disabledPasswordHash,
      role: "OWNER",
      status: "DISABLED",
      mfaEnabled: false,
    }),
    upsertSyntheticUser({
      email: SUSPENDED_SESSION_EMAIL,
      passwordHash: suspendedSessionPasswordHash,
      role: "OWNER",
      mfaEnabled: false,
    }),
    upsertSyntheticUser({
      email: ROLE_CHANGE_EMAIL,
      passwordHash: roleChangePasswordHash,
      role: "OWNER",
      mfaEnabled: false,
    }),
  ]);

  const [agent, roleChangeAgent] = await Promise.all([
    upsertSyntheticAgentProfile({
      userId: agentUser.id,
      email: AGENT_EMAIL,
      legalName: "Authenticated E2E Agent",
      preferredName: "E2E Agent",
      mobile: "+15555550199",
    }),
    upsertSyntheticAgentProfile({
      userId: roleChangeUser.id,
      email: ROLE_CHANGE_EMAIL,
      legalName: "Live Role Change Agent",
      preferredName: "Role Change Agent",
      mobile: "+15555550200",
    }),
  ]);

  console.log("Authenticated E2E users ready.", {
    ownerId: owner.id,
    agentUserId: agentUser.id,
    agentId: agent.id,
    mfaUserId: mfaUser.id,
    lockoutUserId: lockoutUser.id,
    lockoutRecoveryUserId: lockoutRecoveryUser.id,
    disabledUserId: disabledUser.id,
    suspendedSessionUserId: suspendedSessionUser.id,
    roleChangeUserId: roleChangeUser.id,
    roleChangeAgentId: roleChangeAgent.id,
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
