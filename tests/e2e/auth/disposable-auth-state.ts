import { PrismaClient, type UserRole, type UserStatus } from "@prisma/client";

const db = new PrismaClient();
const LOCAL_DATABASE_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const ALLOWED_SYNTHETIC_EMAILS = new Set([
  "e2e.suspended-session@mercurycalldesk.test",
  "e2e.role-change@mercurycalldesk.test",
  "e2e.lockout-recovery@mercurycalldesk.test",
]);
const LOCKOUT_RECOVERY_EMAIL = "e2e.lockout-recovery@mercurycalldesk.test";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertDisposableTarget(name: "DATABASE_URL" | "DIRECT_URL") {
  const raw = process.env[name];
  assert(raw, `${name} is required for disposable live-session tests.`);

  const parsed = new URL(raw);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  assert(parsed.protocol === "postgresql:" || parsed.protocol === "postgres:", `${name} must use PostgreSQL.`);
  assert(LOCAL_DATABASE_HOSTS.has(parsed.hostname), `${name} must target localhost.`);
  assert(/(^|[_-])e2e($|[_-])/i.test(databaseName), `${name} database name must contain an isolated e2e token.`);
}

function assertDisposableMutation(email: string) {
  assert(process.env.E2E_ALLOW_DISPOSABLE_DB === "true", "Disposable auth mutation requires explicit opt-in.");
  assert(!process.env.VERCEL_ENV, "Disposable auth mutation is forbidden in Vercel environments.");
  assertDisposableTarget("DATABASE_URL");
  assertDisposableTarget("DIRECT_URL");
  assert(ALLOWED_SYNTHETIC_EMAILS.has(email), `Disposable auth mutation rejected unapproved identity: ${email}`);
}

export async function setSyntheticUserStatus(email: string, status: UserStatus) {
  assertDisposableMutation(email);
  assert(status === "ACTIVE" || status === "SUSPENDED", `Unsupported disposable User status: ${status}`);
  await db.user.update({ where: { email }, data: { status } });
}

export async function setSyntheticUserRole(email: string, role: UserRole) {
  assertDisposableMutation(email);
  assert(role === "OWNER" || role === "AGENT", `Unsupported disposable User role: ${role}`);
  await db.user.update({ where: { email }, data: { role } });
}

export async function expireSyntheticLockout() {
  assertDisposableMutation(LOCKOUT_RECOVERY_EMAIL);
  const user = await db.user.findUnique({
    where: { email: LOCKOUT_RECOVERY_EMAIL },
    select: { failedLogins: true, lockedUntil: true },
  });
  assert(user?.failedLogins === 5, "Synthetic recovery identity must have five failed logins before expiry.");
  assert(user.lockedUntil !== null && user.lockedUntil > new Date(), "Synthetic recovery identity must be actively locked before expiry.");
  await db.user.update({ where: { email: LOCKOUT_RECOVERY_EMAIL }, data: { lockedUntil: new Date(0) } });
}

export async function closeDisposableAuthState() {
  await db.$disconnect();
}
