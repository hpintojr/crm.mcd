# Onboarding Packet Coordinator (Option B) — Staged, Not Live

**Status:** Composition and fail-closed dispatch logic proven with synthetic data. GHL API
field mapping unverified. Not wired into any live flow. Off by default.

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

## What's explicitly NOT proven yet

`src/lib/ghl-documents.ts`'s `extractString()` field mapping for the document id and
signing URL is a best-effort reading of HighLevel's published Send Template contract
(https://marketplace.gohighlevel.com/docs/ghl/proposals/documents-and-contracts-api/index.html).
This repository/session has no live GHL Private Integration token available to it, so
that mapping has not been confirmed against a real response. If the real field names
differ, `sendDocumentTemplate` fails closed (returns `ok:false`) rather than sending a
broken link — but the coordinator simply won't work until this is checked.

## Gates before `ONBOARDING_PACKET_COORDINATOR_ENABLED=true` in production

1. Run one real Send Template call from the production environment against a disposable
   or synthetic GHL contact (not a real applicant) and confirm the response actually
   contains a usable document id and recipient-facing signing URL at the field paths
   listed in `extractString()`. Adjust the field paths if they don't match.
2. Disable or unpublish the native **Agent Onboarding Documents** GHL workflow's four
   Send Document actions (or repoint its trigger away from `agent-approved`), or
   applicants will receive both the native four documents/emails and this one composed
   email for the same four documents.
3. Set the four `GHL_TEMPLATE_ID_*` environment variables to the real GHL template ids.
4. Wire `dispatchOnboardingPacket()` into the admin approval action (or a separate
   explicit "send onboarding packet" admin action) — nothing calls it yet.
5. Run one owner-authorized end-to-end synthetic approval end to end before using it on a
   real applicant.

## Non-negotiable controls preserved

- The admin approval gate (PR #140) is unchanged and untouched by this work.
- No business terms, pricing, commissions, or unrelated GHL locations were touched.
- No live document was sent and no live email was composed or delivered while building
  this — every proof used fabricated document ids, signing URLs, and recipient names.
