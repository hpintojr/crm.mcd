# Mercury Call Desk — Mini CRM (`crm.mcd`)

Secure Agent + Admin portals for Mercury Call Desk. GoHighLevel (GHL) is a **one-way backend**; agents never log into GHL. The CRM uses Neon Postgres as its system of record and releases from GitHub `main` once the Vercel Git integration is connected.

## Production workflow

- `main` is the production source branch.
- Connect this GitHub repository to the MCD CRM project in Vercel; after that, each `main` update triggers the production deployment.
- Production environment values live in Vercel only; never commit credentials.
- Neon schema changes are staged and verified before being applied to the Neon production branch.
- There is no local-machine step required for normal operation.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS (dark theme)
- Prisma ORM + PostgreSQL (Neon)
- Vercel production deployment
- Cloudflare R2 for signed-document mirror (7-year record)

## Current build

- Public partner sign-up at `/signup` creates a submitted agent and four onboarding-document gates.
- GHL contact creation is stub-safe until the production token is configured.
- Auth foundation is included: credentials login, JWT sessions, account lockout, role gates, hashed one-time activation links, and TOTP MFA enrollment.
- `/admin` includes the applicant review queue: confirmation call, approve/e-sign trigger, correction, rejection, audit trail, and integration-error visibility.
- GHL inbound document-completion processing is the next wiring step; applicant approval already uses the protected backend GHL tag action.

## Security / compliance guardrails

- **No SSN in the database or signup form.** It is handled only inside the secure W-9 e-sign process.
- **No raw bank data.** Payout providers store a reference only.
- All secrets are server-only environment values.
- Sensitive actions write to `AuditLog`.
- GHL links, other-client data, and confidential wholesale pricing are never exposed to agents.
