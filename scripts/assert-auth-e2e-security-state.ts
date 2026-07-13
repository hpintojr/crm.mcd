import { PrismaClient, type Prisma } from "@prisma/client";

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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertDisposableDatabase(name: "DATABASE_URL" | "DIRECT_URL") {
  const raw = process.env[name];
  assert(raw, `${name} is required for authenticated E2E state assertions.`);

  const parsed = new URL(raw);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  assert(parsed.protocol === "postgresql:" || parsed.protocol === "postgres:", `${name} must use PostgreSQL.`);
  assert(LOCAL_DATABASE_HOSTS.has(parsed.hostname), `${name} must target localhost for authenticated E2E tests.`);
  assert(/(^|[_-])e2e($|[_-])/i.test(databaseName), `${name} database name must contain an isolated e2e token.`);
}

function metadataObject(value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> {
  assert(value !== null && typeof value === "object" && !Array.isArray(value), "Audit metadata must be an object.");
  return value as Record<string, Prisma.JsonValue>;
}

async function syntheticUser(email: string) {
  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      mfaEnabled: true,
      failedLogins: true,
      lockedUntil: true,
      lastLoginAt: true,
    },
  });
  assert(user, `Synthetic authenticated E2E user is missing: ${email}`);
  return user;
}

async function userAudit(userId: string) {
  return db.auditLog.findMany({
    where: {
      actorUserId: userId,
      entityType: "User",
      entityId: userId,
      actionType: { in: ["LOGIN_FAILED", "ACCOUNT_LOCKED", "LOGIN_SUCCESS", "LOGOUT"] },
    },
    select: {
      actionType: true,
      actorRole: true,
      metadata: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

async function assertOwnerState() {
  const owner = await syntheticUser(OWNER_EMAIL);
  assert(owner.role === "OWNER" && owner.status === "ACTIVE", "Synthetic Owner role/status drifted.");
  assert(owner.failedLogins === 0, "Successful Owner login must reset failedLogins to zero.");
  assert(owner.lockedUntil === null, "Successful Owner login must clear lockedUntil.");
  assert(owner.lastLoginAt !== null, "Successful Owner login must persist lastLoginAt.");

  const audit = await userAudit(owner.id);
  const actions = audit.map((entry) => entry.actionType);
  assert(actions.includes("LOGIN_FAILED"), "Owner audit must include the generic wrong-password failure.");
  assert(actions.includes("LOGIN_SUCCESS"), "Owner audit must include LOGIN_SUCCESS.");
  assert(actions.includes("LOGOUT"), "Owner audit must include LOGOUT.");
  assert(actions.indexOf("LOGIN_FAILED") < actions.indexOf("LOGIN_SUCCESS"), "Owner failure must precede success.");
  assert(actions.indexOf("LOGIN_SUCCESS") < actions.lastIndexOf("LOGOUT"), "Owner success must precede logout.");
  assert(audit.every((entry) => entry.actorRole === "OWNER"), "Owner audit role metadata must remain OWNER.");
}

async function assertAgentState() {
  const agent = await syntheticUser(AGENT_EMAIL);
  assert(agent.role === "AGENT" && agent.status === "ACTIVE", "Synthetic Agent role/status drifted.");
  assert(agent.failedLogins === 0 && agent.lockedUntil === null, "Normal Agent login must remain unlocked.");
  assert(agent.lastLoginAt !== null, "Normal Agent login must persist lastLoginAt.");

  const audit = await userAudit(agent.id);
  assert(audit.some((entry) => entry.actionType === "LOGIN_SUCCESS"), "Agent audit must include LOGIN_SUCCESS.");
  assert(!audit.some((entry) => entry.actionType === "ACCOUNT_LOCKED"), "Normal Agent must not be locked.");
}

async function assertMfaState() {
  const mfaUser = await syntheticUser(MFA_EMAIL);
  assert(mfaUser.role === "OWNER" && mfaUser.mfaEnabled, "Synthetic MFA Owner contract drifted.");
  assert(mfaUser.failedLogins === 0 && mfaUser.lockedUntil === null, "MFA failures must not increment password lock counters.");
  assert(mfaUser.lastLoginAt !== null, "Successful MFA login must persist lastLoginAt.");

  const audit = await userAudit(mfaUser.id);
  const mfaFailureReasons = audit
    .filter((entry) => entry.actionType === "LOGIN_FAILED")
    .map((entry) => metadataObject(entry.metadata).reason);
  assert(mfaFailureReasons.includes("MFA_REQUIRED"), "MFA audit must include MFA_REQUIRED.");
  assert(mfaFailureReasons.includes("MFA_INVALID"), "MFA audit must include MFA_INVALID.");
  assert(audit.some((entry) => entry.actionType === "LOGIN_SUCCESS"), "MFA audit must include LOGIN_SUCCESS.");
  assert(!audit.some((entry) => entry.actionType === "ACCOUNT_LOCKED"), "MFA challenge failures must not lock the account.");
}

async function assertLockoutState() {
  const lockoutUser = await syntheticUser(LOCKOUT_EMAIL);
  assert(lockoutUser.role === "AGENT" && lockoutUser.status === "ACTIVE", "Synthetic lockout identity drifted.");
  assert(lockoutUser.failedLogins === 5, `Lockout identity must persist exactly five failed logins, found ${lockoutUser.failedLogins}.`);
  assert(lockoutUser.lockedUntil !== null, "Lockout identity must persist lockedUntil.");
  assert(lockoutUser.lockedUntil.getTime() > Date.now(), "Lockout timestamp must remain in the future after the browser test.");
  assert(lockoutUser.lastLoginAt === null, "Locked identity must not receive a successful login timestamp.");

  const audit = await userAudit(lockoutUser.id);
  const failures = audit.filter((entry) => entry.actionType === "LOGIN_FAILED");
  const locks = audit.filter((entry) => entry.actionType === "ACCOUNT_LOCKED");
  assert(failures.length === 5, `Lockout audit must contain exactly five LOGIN_FAILED rows, found ${failures.length}.`);
  assert(locks.length === 1, `Lockout audit must contain exactly one ACCOUNT_LOCKED row, found ${locks.length}.`);

  const counters = failures.map((entry) => metadataObject(entry.metadata).failedLogins);
  assert(JSON.stringify(counters) === JSON.stringify([1, 2, 3, 4, 5]),
    `Lockout audit counters must be [1,2,3,4,5], found ${JSON.stringify(counters)}.`);

  const lockMetadata = metadataObject(locks[0]?.metadata ?? null);
  assert(typeof lockMetadata.lockedUntil === "string", "ACCOUNT_LOCKED audit must persist the ISO lockedUntil value.");
  assert(lockMetadata.lockedUntil === lockoutUser.lockedUntil.toISOString(),
    "User.lockedUntil and ACCOUNT_LOCKED metadata must match exactly.");
  assert(!audit.some((entry) => entry.actionType === "LOGIN_SUCCESS"), "Locked identity must not record LOGIN_SUCCESS.");
}


async function assertLockoutRecoveryState() {
  const recoveryUser = await syntheticUser(LOCKOUT_RECOVERY_EMAIL);
  assert(recoveryUser.role === "OWNER" && recoveryUser.status === "ACTIVE",
    "Lockout-recovery identity must remain an ACTIVE Owner.");
  assert(recoveryUser.failedLogins === 0 && recoveryUser.lockedUntil === null,
    "Successful recovery after lock expiry must reset failedLogins and clear lockedUntil.");
  assert(recoveryUser.lastLoginAt !== null,
    "Successful recovery after lock expiry must persist lastLoginAt.");

  const audit = await userAudit(recoveryUser.id);
  const failures = audit.filter((entry) => entry.actionType === "LOGIN_FAILED");
  const locks = audit.filter((entry) => entry.actionType === "ACCOUNT_LOCKED");
  const successes = audit.filter((entry) => entry.actionType === "LOGIN_SUCCESS");
  assert(failures.length === 5,
    `Recovery audit must contain exactly five LOGIN_FAILED rows, found ${failures.length}.`);
  assert(locks.length === 1,
    `Recovery audit must contain exactly one ACCOUNT_LOCKED row, found ${locks.length}.`);
  assert(successes.length === 1,
    `Recovery audit must contain exactly one LOGIN_SUCCESS row, found ${successes.length}.`);
  assert(JSON.stringify(failures.map((entry) => metadataObject(entry.metadata).failedLogins)) === JSON.stringify([1, 2, 3, 4, 5]),
    "Recovery failures must persist counters [1,2,3,4,5].");
  assert(audit.indexOf(locks[0]) < audit.indexOf(successes[0]),
    "Recovery LOGIN_SUCCESS must follow the active-lock rejection and lock expiry.");
  assert(audit.every((entry) => entry.actorRole === "OWNER"),
    "Recovery audit role metadata must remain OWNER.");
}

async function assertOffboardedState() {
  const disabledUser = await syntheticUser(DISABLED_EMAIL);
  assert(disabledUser.role === "OWNER" && disabledUser.status === "DISABLED",
    "Offboarded identity must remain DISABLED.");
  assert(disabledUser.failedLogins === 0 && disabledUser.lockedUntil === null && disabledUser.lastLoginAt === null,
    "Correct-password denial for an disabled account must not issue a session or alter lock state.");

  const audit = await userAudit(disabledUser.id);
  assert(audit.length === 0,
    "Correct-password denial for an disabled account must not create authentication audit events.");
}

async function assertSuspendedSessionState() {
  const suspendedUser = await syntheticUser(SUSPENDED_SESSION_EMAIL);
  assert(suspendedUser.role === "OWNER", "Suspended-session identity must retain its Owner role.");
  assert(suspendedUser.status === "SUSPENDED", "Browser test must persist SUSPENDED status after session issuance.");
  assert(suspendedUser.lastLoginAt !== null, "Suspended-session identity must prove a session was issued before suspension.");
  assert(suspendedUser.failedLogins === 0 && suspendedUser.lockedUntil === null,
    "Suspension enforcement must be independent of failed-login lockout state.");

  const audit = await userAudit(suspendedUser.id);
  const successes = audit.filter((entry) => entry.actionType === "LOGIN_SUCCESS");
  assert(successes.length === 1 && successes[0]?.actorRole === "OWNER",
    "Suspended-session identity must have exactly one Owner LOGIN_SUCCESS before suspension.");
  assert(!audit.some((entry) => entry.actionType === "ACCOUNT_LOCKED"),
    "Suspended-session enforcement must not create lockout evidence.");
}

async function assertRoleChangeState() {
  const roleChangeUser = await syntheticUser(ROLE_CHANGE_EMAIL);
  assert(roleChangeUser.status === "ACTIVE", "Role-change identity must remain ACTIVE.");
  assert(roleChangeUser.role === "AGENT", "Browser test must persist the current AGENT role after Owner session issuance.");
  assert(roleChangeUser.lastLoginAt !== null, "Role-change identity must prove an Owner session was issued first.");
  assert(roleChangeUser.failedLogins === 0 && roleChangeUser.lockedUntil === null,
    "Role-change enforcement must not alter failed-login state.");

  const audit = await userAudit(roleChangeUser.id);
  assert(audit.some((entry) => entry.actionType === "LOGIN_SUCCESS" && entry.actorRole === "OWNER"),
    "Role-change identity must retain Owner LOGIN_SUCCESS evidence from the issued session.");
  assert(!audit.some((entry) => entry.actionType === "ACCOUNT_LOCKED"),
    "Role-change enforcement must not create lockout evidence.");
}

async function main() {
  assert(process.env.E2E_ALLOW_DISPOSABLE_DB === "true",
    "E2E_ALLOW_DISPOSABLE_DB=true is required for authenticated E2E state assertions.");
  assert(!process.env.VERCEL_ENV, "Authenticated E2E state assertions are forbidden in Vercel environments.");
  assertDisposableDatabase("DATABASE_URL");
  assertDisposableDatabase("DIRECT_URL");

  await assertOwnerState();
  await assertAgentState();
  await assertMfaState();
  await assertLockoutState();
  await assertLockoutRecoveryState();
  await assertOffboardedState();
  await assertSuspendedSessionState();
  await assertRoleChangeState();

  console.log("Authenticated E2E persisted security state passed.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Authenticated E2E persisted security state failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
