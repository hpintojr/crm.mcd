# Mercury Call Desk — Mini CRM (`crm.mcd`)

Secure Agent + Admin portals for Mercury Call Desk. GoHighLevel (GHL) is wired in as a **one-way backend**; agents never log into GHL. This repo is the software build; the product scope lives in the workspace docs under `02 Projects/MCD CRM - Agent and Admin Portals/`.

## Stack
- Next.js 15 (App Router) + TypeScript
- Tailwind CSS (dark theme)
- Prisma ORM + PostgreSQL (Neon)
- Deploys to Vercel
- Cloudflare R2 for signed-document mirror (7-year record)

## Getting started
```bash
npm install
cp .env.example .env.local     # fill in DATABASE_URL etc.
npm run prisma:generate
npm run prisma:migrate         # creates tables in your Neon dev branch
npm run dev                    # http://localhost:3000
```

The app runs **before GHL is connected**: the GHL client falls back to a safe stub, so the
signup flow works end-to-end locally. Fill `GHL_PRIVATE_TOKEN` + `GHL_SALES_HQ_LOCATION_ID`
to go live.

## What's built (Phase 1, first slice)
- Landing page + dark theme shell.
- Public partner sign-up at `/signup` → `POST /api/signup`:
  - validates input (zod), blocks duplicates, honeypot bot-trap,
  - ports the applicant to a GHL Sales HQ contact (tag `agent-signup`),
  - creates a `SUBMITTED` agent with the four onboarding-document gates pending,
  - writes an audit-log entry.

## Security / compliance guardrails (do not regress)
- **No SSN in the database or on the signup form.** SSN is captured only inside the W-9 e-sign
  document and retrieved from that signed PDF.
- **No raw bank data.** Payout (Stripe / bill.com) stores a token/reference only.
- **Email**: agents never log in; the CRM accesses mailboxes server-side via `EMAIL_ACCESS_TOKEN`.
- All secrets are server-only env vars; never import `@/lib/env` into a client component.
- Sensitive actions write to `AuditLog`.

## Next up (roadmap)
1. Admin: applicant review + the `agent-approved` tag that triggers the GHL e-sign workflow.
2. Inbound GHL webhook (`/api/ghl/documents`) → flip onboarding gates on "completed".
3. Agent activation (one-time link → password + MFA) and the agent portal shell.
4. Leads engine (pools, atomic claim) and the demo-booking handoff to GHL.
5. Funding relay (`/api/ghl/funding`) → commission ledger (50/50 Net Commissionable Profit).
