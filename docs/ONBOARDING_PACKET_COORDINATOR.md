# Onboarding Packet Coordinator (Option B) — ABANDONED (2026-07-14)

**Decision:** After confirming live that GHL's public Documents & Contracts API does not
return a recipient-facing signing URL (see "Critical finding" below), the owner decided
to abandon this coordinator and keep GHL's original/native behavior: four separate
documents, four separate emails, exactly as the existing "Agent Onboarding Documents" GHL
workflow already sends them. This PR was never merged and none of this code was ever
wired into a live flow or enabled (`ONBOARDING_PACKET_COORDINATOR_ENABLED` stayed
`false` the entire time), so no production behavior changes as a result of this decision
— the native four-email flow was already what applicants receive today, and continues to
be what applicants receive going forward.

This file, and the code in this branch, are kept only as a record of the investigation
for future reference in case a combined-email approach is revisited later (e.g. if
HighLevel documents or exposes a recipient-link field, or clarifies what's behind the
"Share via link" UI action — see "Critical finding" below).

---

**Status:** Composition and fail-closed dispatch logic proven with synthetic data. Real
GHL template ids confirmed live. One real test document was sent end to end through the
GHL web UI to a disposable test contact and confirmed delivered. **Confirmed live
(2026-07-14) that the public Send Template / List Documents API responses contain no
recipient-facing signing URL at all — see "Critical finding" below.** This is a bigger
gap than a field-name mismatch and is why this design was abandoned. Not wired into any
live flow. Off by default.

## Operating decision

The owner wants one email containing four secure document links instead of GHL's native
behavior of one email per document (four emails). Two designs were evaluated:

1. **Native one-packet design** — combine the four documents into a single GHL
   template/envelope. Simplest, but collapses the existing independently-auditable
   `document_type` tracking (`SALES_AGREEMENT`, `NDA_IP`, `W9_PAYOUT`, `ACKNOWLEDGMENT`)
   used by `src/app/api/ghl/documents/route.ts` and requires legal/audit review.
2. **Four independent documents + custom delivery coordinator (this design)** — keep the
   four documents and the existing per-document completion-relay architecture exactly as
   built; add a small coordinator that sends the four documents via GHL's Send Template
   API, collects each one's secure signing link from that same response, and — only if
   all four succeed — sends one CRM-composed email with all four links.

Option 2 was selected on paper because it preserves the already-built, already-gated
four-document audit trail (`onboardingDocument` table, per-template completion webhooks,
the `fourGatesComplete` check before agent provisioning) without any redesign. **It was
ultimately abandoned** — see "Critical finding" below — because step 2's core premise
(read the signing link from the Send Template response) was disproven against the real
API, and the owner chose to keep the native four-email behavior (**neither Option 1 nor
Option 2**) rather than continue chasing an unconfirmed alternate link source.

## What's implemented (kept for reference only — not going live)

- `src/lib/ghl-documents.ts` — calls GHL's Documents & Contracts **Send Template** public
  API (one call per document, no polling). As of 2026-07-14 this correctly targets the
  real endpoint shape and required fields (see "Verified live" below), but the attempt to
  read a signing URL from that same response is now known to be unsatisfiable — the real
  response doesn't contain one. `sendDocumentTemplate()` fails closed (`ok: false`) every
  time against the real API today; this is intentional, not a bug.
- `src/lib/emails/onboarding-packet-email.ts` — composes the one email from exactly four
  links. Pure, no network calls.
- `src/lib/onboarding-packet-dispatch-policy.ts` — pure decision: send the email only if
  all four document sends succeeded; any single failure blocks the email and returns the
  exact failure(s), so an applicant never receives a partial/broken packet.
- `src/lib/onboarding-packet-coordinator.ts` — orchestrates the above: dispatch four
  documents in parallel, apply the fail-closed policy, send the email, log an audit entry.
- `scripts/check-onboarding-packet-coordinator.ts` — synthetic-data proof of the
  composition and fail-closed policy (all-success, one-failure, all-failure, exactly-four-
  links contract, HTML-escaping). Zero live GHL or SMTP calls. Run with
  `npm run check:onboarding-packet-coordinator`.

## Verified live in the MCD GHL account (2026-07-14)

Logged into the MCD GoHighLevel sub-account directly (Payments → Documents & Contracts)
and confirmed the following against the real account, not documentation:

- The four templates referenced by this coordinator exist and are published, with these
  real template ids:

  | Document type | Template name | Template id |
  |---|---|---|
  | `SALES_AGREEMENT` | MCD - Sales Partner Agreement | `6a4586d766f3bacccf2a9ff7` |
  | `NDA_IP` | MCD - NDA / Confidentiality and IP Agreement | `6a458a0466f3ba56a42af191` |
  | `W9_PAYOUT` | MCD - W-9 / Payout Intake | `6a458b776a7ea4c86263dc3d` |
  | `ACKNOWLEDGMENT` | MCD - New Hire Acknowledgment | `6a458b37c17177da8ec5c7d0` |

- Sent one real "MCD - New Hire Acknowledgment" document through the GHL web UI to a
  disposable test contact (`Agent 1 Test`, `agent1@bennyandpenny.com`, tagged
  `agent-signup` — not a real applicant, not the owner's own account). The document moved
  to "Sent" / "Waiting for others" in the GHL dashboard, confirming the template, contact
  model, and delivery path all work end to end.
- Ran a real, direct, server-side call to the public API (a one-off script from a machine
  holding `GHL_PRIVATE_TOKEN`, not through the web UI) and captured the raw JSON response
  of both `POST /proposals/templates/send` and `GET /proposals/document`. This confirmed
  the real request/response contract, documented below, and produced the critical finding
  in the next section.

### Real Send Template API contract (confirmed, 2026-07-14)

- Endpoint: `POST https://services.leadconnectorhq.com/proposals/templates/send` —
  **not** `/proposals/templates/{id}/send`. `templateId` goes in the JSON body, not the
  URL path.
- Required body fields: `templateId`, `userId` (a real GHL user id — omitting it returns
  `422`), `sendDocument`, `locationId`, `contactId`.
- Required header: `Version: v3` for this endpoint family specifically — **not**
  `2021-07-28` (the app's general default `GHL_API_VERSION`).
- Response contains only internal ids (`links[]._id`, `links[].referenceId`,
  `links[].documentId`, `links[].recipientId` — which is just the contact id sent, not a
  link id). **No URL field anywhere.**

### Real List Documents API contract (confirmed, 2026-07-14)

- Endpoint: `GET https://services.leadconnectorhq.com/proposals/document?locationId=...`,
  `Version: v3`. Returns each document's full record. **Also no URL field anywhere.**

## Critical finding (2026-07-14): the public API does not expose a signing URL

Three real, live API responses — one Send Template response and one List Documents
response containing the full document object — all confirm the same thing: **GHL's
public Documents & Contracts v3 API never returns a recipient-facing signing/public URL.
It only returns internal ids.** This directly contradicts this coordinator's core design
assumption. It is not a naming issue in `extractString()` — the field simply isn't in the
response, at any path.

A real public link does exist for documents in this account — the GHL web UI's separate
"**Share via link**" action (distinct from "Send Document") produced:

```
https://system.futureassistant.ai/documents/v1/47d46256-c6a7-43f0-903a-188b01dce41a?locale=en-US
```

But that link's UUID does not match `documentId`, `links[]._id`, `referenceId`, or
`recipientId` from the real API responses for that same document — it is not derivable
from this module's Send Template call. Repeated attempts to capture the network request
behind "Share via link" (browser network-log reader, `window.fetch` monkey-patch) did not
succeed — calls were either not retained or auto-redacted as URL/cookie data by the
browser tooling's own safety filtering, which was not circumvented. It remains
unconfirmed whether "Share via link" is a documented public endpoint, an undocumented
one, or a session-cookie-only internal endpoint unreachable with a `GHL_PRIVATE_TOKEN`.

**Options considered, and the decision:**

1. Find a documented public API call that returns a recipient link — not confirmed to
   exist based on everything captured.
2. Identify and confirm the endpoint behind "Share via link" and whether it's
   server-callable — would need a HAR capture from a real logged-in browser session or
   asking HighLevel support directly. Not pursued further.
3. **Chosen:** keep GHL's native per-document email (four separate emails) and drop this
   coordinator entirely. Nothing needs to change in GHL to do this — the native "Agent
   Onboarding Documents" workflow's four Send Document actions were never disabled or
   modified during this investigation, so this is already the live behavior.

## Non-negotiable controls preserved

- The admin approval gate (PR #140) is unchanged and untouched by this work.
- No business terms, pricing, commissions, or unrelated GHL locations were touched.
- No live document was sent to a real applicant and no live email was composed or
  delivered to a real applicant. All live documents sent during this investigation went
  to the same disposable, clearly-labeled test contact (`Agent 1 Test`) that already
  existed in the MCD account for this purpose, with the owner's explicit action-time
  authorization. No bearer token was extracted from the browser session.
