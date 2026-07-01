# Build Spec 02 — Admin Applicant Review & GHL Approve Tag (for ChatGPT)
**Project:** crm.mcd · **Depends on:** Spec 01 (auth). **Read first:** `[C] AI Handoff & Scope Review.md`.

## 0. Goal
Give admins a screen to review incoming applicants (agents at `SUBMITTED`), record the **confirm call**, and **approve** — where approve writes the `agent-approved` tag to the applicant's GHL contact. That tag is the single human trigger that starts the GHL e-sign workflow (defined in GHL, not in code). Also support **request-correction** and **reject**.

**In scope:** applicant list + detail, confirm-call flag, approve/reject/request-correction actions, GHL tag write, audit.
**Out of scope:** the GHL e-sign workflow itself (configured in GHL), the inbound "documents completed" webhook (Spec 03).

## 1. Prisma additions (`Agent`)
```prisma
model Agent {
  // ...existing
  confirmedCallAt DateTime?
  approvedById    String?
  approvedAt      DateTime?
  reviewNote      String?
}
```
Migrate: `prisma migrate dev -n applicant_review`.

## 2. GHL client additions (`src/lib/ghl.ts`)
Add (stub-safe like `upsertSalesHqContact`):
```ts
export async function addContactTag(contactId: string, tag: string): Promise<GhlResult<{ ok: true }>>
export async function removeContactTag(contactId: string, tag: string): Promise<GhlResult<{ ok: true }>>
```
- Real impl: `POST {apiBase}/contacts/{contactId}/tags` with `{ tags: [tag] }`, headers from the existing `headers()`.
- Stub mode (no token): return `{ ok: true, stub: true, data: { ok: true } }` and do nothing.

## 3. Files
```txt
src/app/admin/applicants/page.tsx            server component; requireRole([OWNER,SUPER_ADMIN,SALES_MANAGER]);
                                             lists Agent where status in (SUBMITTED, PENDING_REVIEW, NEEDS_CORRECTION).
src/app/admin/applicants/[id]/page.tsx       detail: profile fields, GHL contact link status, action buttons.
src/app/admin/applicants/[id]/actions.ts     "use server" actions: confirmCall, approveApplicant, requestCorrection, rejectApplicant.
src/components/admin/ApplicantActions.tsx     client component wiring the buttons to the server actions.
```

## 4. Server actions (all: requireRole, zod, audit)
```txt
confirmCall(agentId)            → set confirmedCallAt = now; audit APPLICANT_CONFIRMED_CALL.
approveApplicant(agentId)       → REQUIRE confirmedCallAt is set (else throw "confirm the call first").
                                  set status = APPROVED, approvedById = session.user.id, approvedAt = now.
                                  if agent.ghlContactId → addContactTag(ghlContactId, "agent-approved").
                                  audit APPLICANT_APPROVED (+ note whether GHL tag was live or stub).
requestCorrection(agentId, note)→ status = NEEDS_CORRECTION, reviewNote = note; audit.
rejectApplicant(agentId, reason)→ status = REJECTED, reviewNote = reason; audit. (Do not delete the record.)
```
Notes: never expose GHL errors to the client verbatim — surface a friendly message and log the detail to `AuditLog`/`IntegrationError`.

## 5. UI
- Dark theme, reuse existing patterns. List = table with name, personal email, submitted date, status chip, "Review" link.
- Detail = read-only profile, a "Confirmed by call" toggle (sets `confirmedCallAt`), then Approve (disabled until confirmed), Request correction (note), Reject (reason).
- Show the GHL link state: "GHL contact: linked / stub / not linked".

## 6. Acceptance criteria
```txt
[ ] Only OWNER/SUPER_ADMIN/SALES_MANAGER can load /admin/applicants (others redirect/forbidden).
[ ] Approve is blocked until "Confirmed by call" is set.
[ ] Approve sets status APPROVED, stamps approver, and calls addContactTag(...,"agent-approved") (stub logs when no token).
[ ] Request-correction and reject set status + note; record is never deleted.
[ ] Every action writes an AuditLog row with actor + entity + ip.
[ ] Build + typecheck clean.
```

## 7. Cleanup checklist (Claude)
```txt
[ ] requireRole enforced server-side on the page AND each action (not just hidden buttons).
[ ] GHL tag failure does not block the status change but IS recorded (IntegrationError) for retry.
[ ] No PII beyond what's needed rendered; no secrets in client bundle.
[ ] Status transitions valid (SUBMITTED/PENDING_REVIEW/NEEDS_CORRECTION → APPROVED/REJECTED).
```
