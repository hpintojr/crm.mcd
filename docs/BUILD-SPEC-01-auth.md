# Build Spec 01 — Auth.js v5 Foundation (for ChatGPT)
**Project:** Mercury Call Desk Mini CRM · repo `hpintojr/crm.mcd`
**Date:** 2026-06-30 · **Author:** Claude (spec) → ChatGPT (build) → Claude (cleanup)
**Read first:** `[C] AI Handoff & Scope Review.md` (conventions + build state). Do not restate business rules; follow them.

---

## 0. Goal of this slice
Add authentication, sessions, roles, MFA, and the one-time **activation** flow to the existing scaffold, so every later admin/agent screen can be protected. This slice is auth **only** — no admin screens or agent portal features beyond a placeholder page behind each guard.

**In scope:** Auth.js v5 config, credentials login, TOTP MFA, activation-by-token (set password + enroll MFA), route protection (middleware + server guards), an admin-seed script, audit logging of auth events.
**Out of scope (next slices):** applicant-review UI, GHL tag action, inbound webhooks, leads, commissions.

---

## 1. Locked decisions (do not deviate)
```txt
- Auth library: Auth.js v5 (next-auth@beta / v5). Session strategy: JWT (no DB session adapter).
- Password hashing: @node-rs/argon2 (argon2id). Do NOT use bcrypt. (Vercel-safe prebuilt binaries.)
- MFA: TOTP via otplib; QR via qrcode. MFA required for OWNER/SUPER_ADMIN/FINANCE_MANAGER/COMPLIANCE_MANAGER/SALES_MANAGER; optional-but-supported for AGENT (config flag, default required = false for agents in v1).
- No public self-registration for logins. Admins are seeded; agents are provisioned (INVITED) by the onboarding flow and activate via a one-time token.
- Follow all conventions in §4 of the handoff doc (src/, @/*, zod, server-only env, dark Tailwind, audit rows, server-side authz).
```

---

## 2. Packages to add
```bash
npm i next-auth@beta @node-rs/argon2 otplib qrcode
npm i -D @types/qrcode
```
`next-auth@beta` is Auth.js v5. If `@node-rs/argon2` gives trouble on the target, fall back to `argon2` (native) — but prefer node-rs.

---

## 3. Env additions (`.env.example` + `.env.local`)
```txt
AUTH_SECRET=""            # required; generate with: npx auth secret  (or openssl rand -base64 32)
AUTH_URL="http://localhost:3000"   # dev; set to https://crm.mercurycalldesk.com in prod
AUTH_TRUST_HOST="true"    # needed on Vercel/behind proxy
```
Add these to `src/lib/env.ts` under an `auth` block (server-only). Do NOT expose to the client.

---

## 4. Prisma schema additions (`prisma/schema.prisma`)
Extend the existing `User` model and add enums + models. Keep existing fields.
```prisma
enum UserStatus {
  INVITED
  ACTIVE
  SUSPENDED
  DISABLED
}

// --- extend User ---
model User {
  // ...existing: id, email, role, passwordHash, mfaEnabled, agent, createdAt, updatedAt
  status         UserStatus @default(INVITED)
  totpSecret     String?    // encrypted at rest if possible; never returned to client
  lastLoginAt    DateTime?
  failedLogins   Int        @default(0)
  lockedUntil    DateTime?
  activationTokens ActivationToken[]
}

// One-time activation / password-set token. Store a HASH of the token, not the raw value.
model ActivationToken {
  id         String    @id @default(cuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id])
  tokenHash  String    @unique          // sha256 of the raw token sent in the link
  purpose    String    @default("ACTIVATION")  // ACTIVATION | PASSWORD_RESET
  expiresAt  DateTime
  usedAt     DateTime?
  createdAt  DateTime  @default(now())

  @@index([userId])
}
```
Run `prisma migrate dev -n auth_foundation` after.

---

## 5. Files to create

### 5.1 `src/lib/password.ts`
- `hashPassword(plain): Promise<string>` — argon2id via `@node-rs/argon2`.
- `verifyPassword(hash, plain): Promise<boolean>`.
- `hashToken(raw): string` — sha256 hex (for ActivationToken lookup).
- `generateToken(): string` — 32 random bytes, base64url.

### 5.2 `src/lib/authz.ts` (server-only helpers)
- `type Role` re-export of Prisma `UserRole`.
- `ADMIN_ROLES = [OWNER, SUPER_ADMIN, SALES_MANAGER, COMPLIANCE_MANAGER, FINANCE_MANAGER]`.
- `requireUser()` — returns the session user or throws/redirects to `/login`.
- `requireRole(roles: Role[])` — guard for server components/actions; redirect to `/login?e=forbidden` if not allowed.
- `mfaRequiredForRole(role): boolean`.

### 5.3 `src/auth.config.ts` (edge-safe — NO prisma, NO argon2 here)
- Exports the base `NextAuthConfig`: `pages: { signIn: "/login" }`, `session: { strategy: "jwt" }`, `callbacks.authorized` for middleware, and the `jwt`/`session` callbacks that copy `id`, `role`, `status`, `mfa` onto the token/session. Providers array is added in `auth.ts`.

### 5.4 `src/auth.ts` (Node runtime — full config)
- `import NextAuth from "next-auth"; import Credentials from "next-auth/providers/credentials";`
- Spread `authConfig` and add the Credentials provider whose `authorize`:
  1. zod-validate `{ email, password, totp? }`.
  2. Load user by email; if none or `status !== ACTIVE` → return null.
  3. Check `lockedUntil`; if locked → throw a friendly error.
  4. `verifyPassword`; on fail → increment `failedLogins`, set `lockedUntil` after N (e.g. 5) attempts, audit `LOGIN_FAILED`, return null.
  5. If `mfaEnabled`: require `totp`; verify with `otplib.authenticator.check(totp, user.totpSecret)`. If missing/invalid → throw error code `MFA_REQUIRED` / `MFA_INVALID` (login form uses this to reveal the code field).
  6. On success: reset `failedLogins`, set `lastLoginAt`, audit `LOGIN_SUCCESS`, return `{ id, email, role, status }`.
- Export `{ handlers, auth, signIn, signOut }`.

### 5.5 `src/app/api/auth/[...nextauth]/route.ts`
```ts
export { GET, POST } from "@/auth";
```

### 5.6 `middleware.ts` (repo root or src/)
- `export { auth as middleware } from "@/auth"` using the **edge-safe** `authConfig` (import from `auth.config.ts`, wrap with `NextAuth(authConfig).auth`). The `authorized` callback enforces:
  - public: `/`, `/signup`, `/activate`, `/login`, `/api/signup`, `/api/auth/*`, static.
  - `/admin/**` → ADMIN_ROLES only.
  - `/portal/**` → AGENT (and admins allowed).
- `matcher` excludes `_next`, static, favicon.

### 5.7 Login UI — `src/app/(auth)/login/page.tsx` + `login-form.tsx` (client)
- Email + password; a TOTP field that appears when the server returns `MFA_REQUIRED`/`MFA_INVALID`.
- Calls `signIn("credentials", { redirect: false, ... })`; on success `router.push` to role landing (`/admin` or `/portal`); show inline errors (dark theme, reuse the `Field` pattern from signup).

### 5.8 Activation — `src/app/activate/page.tsx` + `POST /api/activate`
- Page reads `?token=`; server verifies `hashToken(token)` against `ActivationToken` (unused + unexpired).
- Step 1: set password (zod: min length, confirm).
- Step 2: enroll TOTP — generate secret, show QR (`otplib.authenticator.keyuri(user.email, "Mercury Call Desk", secret)` → `qrcode`), verify a 6-digit code before saving `totpSecret` + `mfaEnabled = true`.
- On completion: set `passwordHash`, `status = ACTIVE`, mark token `usedAt`, audit `ACTIVATION_COMPLETED`. Redirect to `/login`.

### 5.9 Admin seed — `scripts/create-admin.ts` (run with `tsx`/`ts-node`)
- CLI: reads `ADMIN_EMAIL` + `ADMIN_PASSWORD` from env or args; creates an `OWNER` user `status = ACTIVE` with hashed password and `mfaEnabled = false` (they can enroll MFA on first login via a `/settings/security` stub — or leave MFA enrollment as a follow-up). Idempotent (upsert by email). Add `npm run seed:admin`.

### 5.10 Guarded placeholders (prove the guards work)
- `src/app/admin/page.tsx` — `await requireRole(ADMIN_ROLES)`; render "Admin — logged in as {email} ({role})".
- `src/app/portal/page.tsx` — `await requireRole([AGENT, ...ADMIN_ROLES])`; render "Agent portal".
- A `SignOutButton` client component.

---

## 6. Auth event auditing
Write an `AuditLog` row for: `LOGIN_SUCCESS`, `LOGIN_FAILED`, `ACCOUNT_LOCKED`, `ACTIVATION_STARTED`, `ACTIVATION_COMPLETED`, `MFA_ENROLLED`, `LOGOUT`. Include `actorUserId`, `ipAddress` (from headers), and minimal metadata (never the password or TOTP).

---

## 7. Route protection matrix
```txt
PUBLIC:            /  /signup  /activate  /login  /api/signup  /api/auth/*  static
ADMIN (roles):     /admin/**        → OWNER, SUPER_ADMIN, SALES_MANAGER, COMPLIANCE_MANAGER, FINANCE_MANAGER
AGENT:             /portal/**       → AGENT (admins may view)
Everything else:   authenticated users only.
```

---

## 8. Acceptance criteria (ChatGPT: verify before handing back)
```txt
[ ] npm run build succeeds; npm run typecheck clean.
[ ] Seed creates an OWNER; can log in at /login → lands on /admin.
[ ] Wrong password increments failedLogins; after 5, account locks until lockedUntil; audit rows written.
[ ] An INVITED user with an activation token can set password + enroll TOTP at /activate, then log in with email+password+TOTP.
[ ] MFA: login without the code returns MFA_REQUIRED and the form reveals the code field; correct code logs in.
[ ] Unauthped /admin and /portal redirect to /login; an AGENT hitting /admin is forbidden.
[ ] @/lib/env and prisma/argon2 are NOT imported in any "use client" file or in auth.config.ts (edge).
[ ] No secrets logged; AUTH_SECRET required; cookies HTTP-only + secure in prod.
[ ] Dark theme consistent with existing pages; reuses the signup Field pattern.
```

---

## 9. Gotchas / notes for ChatGPT
```txt
- Auth.js v5 split config: keep prisma + argon2 OUT of auth.config.ts (it runs on the edge via middleware).
  Put the Credentials provider + DB calls in auth.ts (Node runtime).
- Credentials + JWT: there is NO database session; role/status live in the JWT. Re-check status on sensitive
  server actions (a disabled user could still hold a valid JWT until it expires) via requireRole reading the DB.
- otplib default window is fine; allow a small step window (1) for clock drift.
- Store totpSecret encrypted if a KMS/encryption helper exists; otherwise plain column is acceptable for v1 but
  flag it for Claude's cleanup (envelope encryption is a P2 item).
- Do not build the "send activation email" transport here — expose a function createActivation(userId) that
  returns the raw token + link; the onboarding webhook slice will wire the actual send (Sequenzy/transactional).
```

---

## 10. Cleanup checklist (Claude, after ChatGPT's pass)
```txt
[ ] Verify edge/node split (no prisma/argon2 in edge config or middleware bundle).
[ ] Confirm requireRole re-reads DB status (not just JWT) on sensitive actions.
[ ] Confirm token is stored hashed; raw token only ever in the emailed link.
[ ] Lockout + failedLogins reset paths correct; no user enumeration in error messages.
[ ] Audit rows on every auth event; no secrets in logs/metadata.
[ ] Types: no `any`; zod at every boundary. Run build + typecheck.
[ ] Update handoff doc §3 build state + add a daily log entry.
```
