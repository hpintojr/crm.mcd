# Build Spec 03 — Inbound GHL Webhooks & Provisioning (for ChatGPT)
**Project:** crm.mcd · **Depends on:** Spec 01 (auth/activation), Spec 02 (approve tag). **Read first:** `[C] AI Handoff & Scope Review.md` + `[C] GHL Backend Integration Spec.md`.

## 0. Goal
Stand up the inbound-webhook framework (auth + idempotency + error queue) and the **onboarding provisioning** path: when GHL reports the agent's documents (agreement, NDA, W-9, acknowledgment) are **completed**, flip the onboarding gates and **provision the MiniCRM user** (create `User` INVITED + an activation token), returning the activation link for sending.

**In scope:** shared inbound verify util, `/api/ghl/documents`, provisioning, WebhookEvent idempotency, IntegrationError queue. Stub endpoints for `/api/ghl/appointments|opportunities|invoices|funding` (verify + enqueue + 200; full logic in later specs).
**Out of scope:** commission math (Spec 09), booking logic (Spec 08), actually sending the activation email (expose the link; wiring the sender is separate).

## 1. Reality check (do NOT design around a signature)
GHL Custom Webhooks are **not** HMAC-signed. Authenticate with: a **shared-secret header** (`X-MCD-Webhook-Secret` == `GHL_WEBHOOK_SECRET`) + a **location-id allowlist** + **idempotency** on the event id. Reject/quarantine anything else.

## 2. Prisma additions
```prisma
model WebhookEvent {
  id          String   @id @default(cuid())
  provider    String   @default("GHL")
  ghlEventId  String   @unique         // idempotency key
  locationId  String?
  type        String
  payload     Json
  status      String   @default("RECEIVED") // RECEIVED | PROCESSED | ERROR
  processedAt DateTime?
  createdAt   DateTime @default(now())
  @@index([type])
}

model IntegrationError {
  id         String   @id @default(cuid())
  source     String                       // e.g. "ghl.documents"
  refId      String?                      // ghlEventId / contactId
  message    String
  payload    Json?
  resolved   Boolean  @default(false)
  createdAt  DateTime @default(now())
}
```
Also allow an allowlist of location ids via env (`GHL_ALLOWED_LOCATION_IDS` = comma list; include the Sales HQ id).

## 3. Shared util `src/lib/ghlWebhook.ts` (server-only)
```txt
verifyInbound(req): { ok, locationId } — checks X-MCD-Webhook-Secret === env, and locationId ∈ allowlist.
recordEvent({ ghlEventId, locationId, type, payload }): returns { firstTime: boolean } — inserts WebhookEvent,
  swallows unique-violation as firstTime=false (idempotent, no double-processing).
logIntegrationError(source, refId, message, payload).
```
Every inbound route: `verifyInbound` → parse → `recordEvent` (if not firstTime → 200 no-op) → enqueue/process → 200 fast. On unmatched refs → `logIntegrationError` + respond 202.

## 4. `/api/ghl/documents` (the provisioning path)
Payload (map from the GHL workflow Custom Webhook; fields you'll configure in GHL):
```json
{ "ghl_event_id":"...", "location_id":"...", "ghl_contact_id":"...",
  "document_type":"SALES_AGREEMENT|NDA_IP|W9|ACKNOWLEDGMENT",
  "status":"COMPLETED", "document_id":"...", "signer_ip":"...", "countersigned":true,
  "completed_at":"..." , "mini_crm_agent_id":"..." }
```
Processing:
```txt
1. verifyInbound + recordEvent (idempotent).
2. Resolve Agent by mini_crm_agent_id (fallback ghl_contact_id). If none → IntegrationError + 202.
3. Upsert the matching OnboardingDocument: status COMPLETED, ghlDocumentId, signerIp, countersigned, completedAt. Audit.
4. If ALL FOUR docType gates COMPLETED for the agent AND not already provisioned:
     - create User (role AGENT, status INVITED, email = agent.personalEmail) linked to the agent (agent.userId).
     - token = createActivation(userId)  (from Spec 01) → returns { rawToken, link }.
     - set agent.status = APPROVED→(stays) ; mark provisioning done.
     - EMIT the activation link: for now call a stub sendActivationEmail(agent.personalEmail, link) that logs +
       writes an AuditLog ACTIVATION_LINK_ISSUED (do NOT depend on a real sender yet).
     - audit AGENT_PROVISIONED.
5. Respond 200.
```
Idempotency: re-delivery must not create a second User or a second activation token.

## 5. Stub endpoints (framework only)
`/api/ghl/appointments`, `/api/ghl/opportunities`, `/api/ghl/invoices`, `/api/ghl/funding`:
```txt
verifyInbound → recordEvent → (TODO marker: handled in Spec 08/09) → 200.
```
This proves the inbound framework end-to-end and reserves the routes.

## 6. Admin: error queue view
`src/app/admin/integrations/errors/page.tsx` — requireRole(ADMIN_ROLES); list unresolved `IntegrationError`; a "resolve" action (audited). (Retry tooling can come later.)

## 7. Acceptance criteria
```txt
[ ] Bad/missing secret or unknown location → rejected (401) or quarantined (202) with an IntegrationError; never processed.
[ ] Duplicate ghl_event_id → no-op 200 (no double provisioning, no duplicate user/token).
[ ] Completing the 4th document gate creates exactly one INVITED User + one activation token and issues the link (stub).
[ ] Unmatched agent → IntegrationError + 202 (not a 500).
[ ] Stub endpoints accept + record + 200.
[ ] Build + typecheck clean.
```

## 8. Cleanup checklist (Claude)
```txt
[ ] Idempotency truly prevents double-provision under re-delivery (test twice).
[ ] Secret compared with a constant-time check; secret only from env (server).
[ ] Activation token stored hashed (Spec 01); only the raw link is emitted, never persisted raw.
[ ] All four gates required before provisioning; partial completion does nothing.
[ ] Errors land in IntegrationError (admin-visible), responses fast (<~1s), no unhandled throws.
```
