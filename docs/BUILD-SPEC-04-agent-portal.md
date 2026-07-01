# Build Spec 04 — Agent Portal & Stripe Connect Onboarding (for ChatGPT)
**Project:** crm.mcd · **Depends on:** Spec 01 (auth), Spec 03 (provisioning). **Read first:** `[C] AI Handoff & Scope Review.md` + `[C] Automated Agent Onboarding Flow (GHL-first).md` §5.

## 0. Goal
The post-activation **agent portal shell** + self-service: finish profile, **set up payouts via Stripe Connect (Express)**, see SSN-on-file status, and view training/certification status. No lead features yet (those are Specs 06–07).

**In scope:** `/portal` layout + nav, profile edit, Stripe Connect onboarding, SSN-on-file flag, training/cert status display.
**Out of scope:** leads, dispositions, commissions, booking.

## 1. Prisma additions (`Agent`)
```prisma
model Agent {
  // ...existing
  stripeConnectId String?
  payoutsEnabled  Boolean @default(false)
}
```
Migrate: `prisma migrate dev -n agent_portal`.

## 2. Stripe client `src/lib/stripe.ts` (server-only, stub-safe)
```txt
- import Stripe from "stripe"; init with env.STRIPE_SECRET_KEY.
- stripeConfigured = Boolean(STRIPE_SECRET_KEY).
- createConnectAccount(agent): creates an Express account (country US, capabilities transfers) → returns accountId.
- createAccountLink(accountId, returnUrl, refreshUrl): hosted onboarding link.
- getAccountStatus(accountId): { payouts_enabled }.
- Stub mode (no key): return synthetic ids / { payouts_enabled:false } so the portal renders locally.
Never store raw bank/routing numbers — only stripeConnectId + payoutsEnabled.
```
Add `stripe` to package.json deps.

## 3. Files
```txt
src/app/portal/layout.tsx           requireRole([AGENT, ...ADMIN_ROLES]); sidebar/nav (Today, Profile, Payouts, Training, Resources).
src/app/portal/page.tsx             "Today" placeholder (leads come later); onboarding checklist progress.
src/app/portal/profile/page.tsx     edit mobile, mailing, emergency contact (zod + server action + audit).
src/app/portal/payouts/page.tsx     Stripe Connect status + "Set up / continue payouts" button.
src/app/portal/payouts/actions.ts   "use server": startConnectOnboarding (create account if needed → account link → redirect);
                                     refreshConnectStatus (getAccountStatus → update payoutsEnabled + audit).
src/app/portal/training/page.tsx    list training modules + completion + certification status (read-only for now).
```

## 4. Payouts flow
```txt
startConnectOnboarding():
  if !agent.stripeConnectId → createConnectAccount → save id.
  createAccountLink(id, returnUrl=/portal/payouts?done=1, refreshUrl=/portal/payouts) → redirect to Stripe.
On return (?done=1): call refreshConnectStatus → set payoutsEnabled from Stripe. Show status badge.
Copy on the page: explain they're setting up their own Stripe account to RECEIVE commission payouts; MCD never sees bank details.
```

## 5. SSN on file
Show "W-9 on file: Yes/No" derived from the `W9_PAYOUT`/W-9 OnboardingDocument status. Not editable in-portal (captured at registration inside the W-9 e-sign). If not on file, link back to the pending onboarding step.

## 6. Acceptance criteria
```txt
[ ] Only activated AGENT (or admins) can load /portal; INVITED/unauth redirect to /login or /activate.
[ ] Profile edit persists + audits; zod-validated.
[ ] "Set up payouts" creates/continues a Stripe Connect Express account and redirects to Stripe (stub: simulated locally).
[ ] Return refreshes payoutsEnabled from Stripe; badge reflects it. No raw bank data stored anywhere.
[ ] Training/cert page renders status read-only.
[ ] Build + typecheck clean.
```

## 7. Cleanup checklist (Claude)
```txt
[ ] @/lib/stripe + env server-only; no Stripe secret in client bundle.
[ ] payoutsEnabled comes from Stripe, not user input; connected-account id stored, never bank numbers.
[ ] Portal guard re-checks DB status (ACTIVE) not just JWT; SUSPENDED/DISABLED locked out.
[ ] Every self-service change audited; dark theme consistent.
```
