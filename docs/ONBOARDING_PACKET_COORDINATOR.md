# Onboarding Packet Coordinator (Option B) — Staged, Not Live

**Status:** Composition and fail-closed dispatch logic proven with synthetic data. Real
GHL template ids confirmed live. One real test document was sent end to end through the
GHL web UI to a disposable test contact and confirmed delivered. The exact JSON response
shape of the Send Template API call is still unverified — see below. Not wired into any
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
`fourGatesComplete` check before agent provisioning) without any redesign.

## What's implemented

- `src/lib/ghl-documents.ts` — calls GHL's Documents & Contracts **Send Template** public
  API (one call per document, no polling) and reads the document id / signing link from
  that same response.
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
- The account's Documents & Contracts API is genuinely reachable at the
  `services.leadconnectorhq.com/proposals/...` path family this module targets (confirmed
  via the app's own network calls, e.g. `proposals/templates/bulk` while browsing the
  template list) — this is the same path family `sendDocumentTemplate` posts to.
- Sent one real "MCD - New Hire Acknowledgment" document through the GHL web UI to a
  disposable test contact (`Agent 1 Test`, `agent1@bennyandpenny.com`, tagged
  `agent-signup` — not a real applicant, not the owner's own account). The document moved
  to "Sent" / "Waiting for others" in the GHL dashboard, confirming the template, contact
  model, and delivery path all work end to end.

## What's still explicitly NOT proven

Sending through the GHL **web UI** goes through GHL's own internal, unversioned frontend
endpoints — not necessarily the same public "Send Template" API contract this coordinator
calls programmatically. I was not able to capture the raw JSON response body of the
API-level send call in this session: browser network-log capture in this environment did
not reliably retain the response for that request (small/rotating buffer, and GHL's
internal app leans on a Firestore real-time channel for post-send state rather than a
large inline REST body), and I deliberately did not attempt to extract the account's
bearer token to call the endpoint directly myself.

So `src/lib/ghl-documents.ts`'s `extractString()` field mapping for the document id and
signing URL is still a best-effort reading of HighLevel's published contract
(https://marketplace.gohighlevel.com/docs/ghl/proposals/documents-and-contracts-api/index.html),
not a confirmed-against-a-real-response mapping. If the real field names differ,
`sendDocumentTemplate` fails closed (returns `ok:false`) rather than sending a broken
link — but the coordinator won't actually work end to end via the API until this is
checked with real server-side credentials (e.g. a one-off `curl`/script run from an
environment that holds `GHL_PRIVATE_TOKEN`, printing the raw JSON body of one Send
Template response).

## Gates before `ONBOARDING_PACKET_COORDINATOR_ENABLED=true` in production

1. From an environment with the real `GHL_PRIVATE_TOKEN`, make one real Send Template API
   call (not through the web UI) against the disposable test contact above and print the
   raw JSON response. Confirm it contains a usable document id and recipient-facing
   signing URL at the field paths listed in `extractString()`; adjust the paths if they
   don't match.
2. Disable or unpublish the native **Agent Onboarding Documents** GHL workflow's four
   Send Document actions (or repoint its trigger away from `agent-approved`), or
   applicants will receive both the native four documents/emails and this one composed
   email for the same four documents.
3. Set the four `GHL_TEMPLATE_ID_*` environment variables to the real template ids listed
   above.
4. Wire `dispatchOnboardingPacket()` into the admin approval action (or a separate
   explicit "send onboarding packet" admin action) — nothing calls it yet.
5. Run one owner-authorized end-to-end synthetic approval before using it on a real
   applicant.

## Non-negotiable controls preserved

- The admin approval gate (PR #140) is unchanged and untouched by this work.
- No business terms, pricing, commissions, or unrelated GHL locations were touched.
- No live document was sent to a real applicant and no live email was composed or
  delivered to a real applicant. The one live document sent today went to a disposable,
  clearly-labeled test contact (`Agent 1 Test`) that already existed in the MCD account
  for this purpose, with the owner's explicit action-time authorization.
