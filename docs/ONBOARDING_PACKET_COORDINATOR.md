# Onboarding Packet Coordinator (Option B) — Staged, Not Live

**Status:** Composition and fail-closed dispatch logic proven with synthetic data. Real
GHL template ids confirmed live. One real test document was sent end to end through the
GHL web UI to a disposable test contact and confirmed delivered. **Confirmed live
(2026-07-14) that the public Send Template / List Documents API responses contain no
recipient-facing signing URL at all — see "Critical finding" below.** This is a bigger
gap than a field-name mismatch and blocks this design until resolved. Not wired into any
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

Option 2 was selected because it preserves the already-built, already-gated four-document
audit trail (`onboardingDocument` table, per-template completion webhooks, the
`fourGatesComplete` check before agent provisioning) without any redesign. **This
selection is now in question — see "Critical finding" below — because step 2's core
premise (read the signing link from the Send Template response) has been disproven
against the real API.**

## What's implemented

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

  These are ready to paste into `GHL_TEMPLATE_ID_SALES_AGREEMENT`,
  `GHL_TEMPLATE_ID_NDA_IP`, `GHL_TEMPLATE_ID_W9_PAYOUT`, and
  `GHL_TEMPLATE_ID_ACKNOWLEDGMENT` in Vercel when this is ready to enable.
- Sent one real "MCD - New Hire Acknowledgment" document through the GHL web UI to a
  disposable test contact (`Agent 1 Test`, `agent1@bennyandpenny.com`, tagged
  `agent-signup` — not a real applicant, not the owner's own account). The document moved
  to "Sent" / "Waiting for others" in the GHL dashboard, confirming the template, contact
  model, and delivery path all work end to end.
- **Ran a real, direct, server-side call to the public API** (a one-off script from a
  machine holding `GHL_PRIVATE_TOKEN`, not through the web UI) and captured the raw JSON
  response of both `POST /proposals/templates/send` and `GET /proposals/document`. This
  confirmed the real request/response contract, documented below, and produced the
  critical finding in the next section.

### Real Send Template API contract (confirmed, 2026-07-14)

- Endpoint: `POST https://services.leadconnectorhq.com/proposals/templates/send` —
  **not** `/proposals/templates/{id}/send`. `templateId` goes in the JSON body, not the
  URL path.
- Required body fields: `templateId`, `userId` (a real GHL user id — omitting it returns
  `422`), `sendDocument`, `locationId`, `contactId`.
- Required header: `Version: v3` for this endpoint family specifically — **not**
  `2021-07-28` (the app's general default `GHL_API_VERSION`). Using the wrong version
  value returns `401 Invalid JWT`-style auth failures in practice.
- Response shape:
  ```json
  {
    "success": true,
    "links": [{
      "_id": "...", "referenceId": "...", "documentId": "...",
      "recipientId": "<the contactId you sent>", "entityName": "...",
      "recipientCategory": "...", "documentRevision": 0, "deleted": false,
      "createdBy": "...", "createdAt": "...", "updatedAt": "...", "__v": 0
    }],
    "traceId": "..."
  }
  ```
- **There is no URL field anywhere in this response.** `recipientId` is just the contact
  id you sent, not a link identifier.

### Real List Documents API contract (confirmed, 2026-07-14)

- Endpoint: `GET https://services.leadconnectorhq.com/proposals/document?locationId=...`,
  `Version: v3`.
- Returns each document's full record, including its own `links` array in the same shape
  as above, plus `status`, `recipients`, `fillableFields`, `paymentStatus`, etc.
- **Also no URL field anywhere in the document object.** The `whiteLabelBaseUrl` field
  documented by HighLevel's public API reference was present in the response shape but
  came back empty/absent for this account in this call — even if populated, no field in
  either response combines it with a document- or recipient-specific path to form a full
  link.

## Critical finding (2026-07-14): the public API does not expose a signing URL

Three real, live API responses — one Send Template response and one List Documents
response containing the full document object — all confirm the same thing: **GHL's
public Documents & Contracts v3 API never returns a recipient-facing signing/public URL.
It only returns internal ids** (`documentId`, link `_id`, `referenceId`). This directly
contradicts this coordinator's core design assumption (read a signing link straight out
of the API response). It is not a naming issue — `extractString()`'s search list
(`url`, `link`, `documentUrl`, `signUrl`, `publicUrl`, etc.) cannot succeed against this
response no matter what paths are tried, because none of those fields exist.

**A real public link does exist, but only via a separate, unconfirmed path.** The GHL web
UI has two distinct actions on a sent document: "Send Document" (native email, what the
public Send Template API triggers) and a separate "**Share via link**" action. Clicking
"Share via link" opened a modal showing a genuine per-recipient URL:

```
https://system.futureassistant.ai/documents/v1/47d46256-c6a7-43f0-903a-188b01dce41a?locale=en-US
```

This confirms recipient-facing links do exist for documents in this account. However:

- The UUID in that URL (`47d46256-c6a7-43f0-903a-188b01dce41a`) was checked against every
  id in the real Send Template and List Documents responses captured for that same
  document (`documentId`, link `_id`, `referenceId`, `recipientId`) — **none of them
  match.** This link's identifier is not derivable from any field the public API returns.
- Repeated attempts to capture the network request that "Share via link" fires (both via
  the browser extension's network-request reader and a `window.fetch` monkey-patch) did
  not succeed — the calls were either not retained by the capture buffer or were
  auto-redacted as URL/cookie data by the browser tooling's own safety filtering, which
  was not circumvented. So it remains **unconfirmed** whether "Share via link" calls a
  documented public endpoint, an undocumented one, or a session-cookie-authenticated
  internal endpoint that isn't reachable at all with a `GHL_PRIVATE_TOKEN` from
  server-side code.

**Net effect:** as designed, this coordinator cannot currently be completed. Fixing
`extractString()`'s field paths will not help — the field simply isn't in the response it
reads. Before this design can move forward, one of the following needs to happen:

1. Find a documented public API call (Send Template or otherwise) that does return a
   recipient link — not confirmed to exist based on everything captured so far.
2. Identify and confirm the actual endpoint behind "Share via link," and confirm it's
   callable server-side with the account's existing API credentials (not a browser-session
   cookie). This needs either a cleaner network capture (e.g. a proxy/HAR capture done
   directly in a real browser session, not through this remote-controlled one) or asking
   HighLevel support directly.
3. Accept GHL's native per-document email (four separate emails) instead of one combined
   email, and drop this coordinator — i.e. revisit whether Option 1 (native one-packet
   template) or simply not combining the emails is preferable to a coordinator that
   cannot get a real signing link.

## Gates before `ONBOARDING_PACKET_COORDINATOR_ENABLED=true` in production

1. **Resolve the signing-URL gap above.** This supersedes the old "verify field names"
   gate — the real blocker is that no confirmed, server-callable API path returns a
   recipient link at all yet, not that the field names in `extractString()` were wrong.
2. Disable or unpublish the native **Agent Onboarding Documents** GHL workflow's four
   Send Document actions (or repoint its trigger away from `agent-approved`), or
   applicants will receive both the native four documents/emails and this one composed
   email for the same four documents.
3. Set the four `GHL_TEMPLATE_ID_*` environment variables to the real template ids listed
   above, plus the new `GHL_SENDING_USER_ID` environment variable (the real GHL user id
   documents are sent as — confirmed live as `QFI1UtOuwrYNKUfBYdIy` for Hamilton Pinto in
   the MCD account, but this should be set explicitly rather than hardcoded).
4. Wire `dispatchOnboardingPacket()` into the admin approval action (or a separate
   explicit "send onboarding packet" admin action) — nothing calls it yet.
5. Run one owner-authorized end-to-end synthetic approval before using it on a real
   applicant.

## Non-negotiable controls preserved

- The admin approval gate (PR #140) is unchanged and untouched by this work.
- No business terms, pricing, commissions, or unrelated GHL locations were touched.
- No live document was sent to a real applicant and no live email was composed or
  delivered to a real applicant. All live documents sent during this investigation
  (through the web UI and through the one-off verification script) went to the same
  disposable, clearly-labeled test contact (`Agent 1 Test`) that already existed in the
  MCD account for this purpose, with the owner's explicit action-time authorization. No
  bearer token was extracted from the browser session; browser-tooling redactions of
  token-like/cookie-like data were respected rather than worked around.
