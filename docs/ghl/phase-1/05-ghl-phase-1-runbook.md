# Mercury Call Desk — GHL Phase 1 Build Runbook

This runbook turns the four document templates in this folder into a working GHL onboarding flow for the MiniCRM integration.

> **Security rule:** Paste the live `GHL_WEBHOOK_SECRET` only in the GHL custom-webhook header. Do not write it in a GHL note, document template, workflow description, screenshot, ticket, Slack message, or Git repository.

---

## 0. Values used throughout

| Item | Value |
| --- | --- |
| GHL location ID | `lEdLVFW0uqKMhmkgFrsX` |
| Onboarding tag | `agent-approved` |
| Document relay endpoint | `https://crm.mercurycalldesk.com/api/ghl/documents` |
| Appointment relay endpoint | `https://crm.mercurycalldesk.com/api/ghl/appointments` |
| Webhook method | `POST` |
| Webhook header | `Content-Type: application/json` |
| Authentication header | `x-mcd-webhook-secret: [PASTE VERCEL GHL_WEBHOOK_SECRET]` |

Use the exact template names listed in `README.md`. Exact naming lets each completion workflow filter to the intended document.

---

# Phase 1 — Agent Onboarding Documents

## 1. Create the document templates

Navigate to **Payments → Documents & Contracts**. Depending on the GHL account configuration, this may appear under **Proposals & Estimates**.

Create these templates by pasting the corresponding file content into GHL’s document editor:

| GHL template name | Source file | Signers | Completion requirement |
| --- | --- | --- | --- |
| `MCD - Sales Partner Agreement` | `01-sales-partner-agreement.md` | Agent + Hamilton Pinto Jr. (`info@mercurycalldesk.com`) | Both signatures required |
| `MCD - NDA / Confidentiality and IP Agreement` | `02-nda-confidentiality-ip-agreement.md` | Agent | Agent signature required |
| `MCD - W-9 / Payout Intake` | `03-w9-payout-intake.md` | Agent | Agent signature required |
| `MCD - New Hire Acknowledgment` | `04-new-hire-acknowledgment.md` | Agent | Agent signature required |

### Sales Partner Agreement recipient configuration

1. Add the **Agent** as the first recipient. Map the recipient to the contact entering the workflow.
2. Add **Hamilton Pinto Jr.** as the second recipient/countersigner using `info@mercurycalldesk.com`.
3. Enable sequential signing: Agent first, Hamilton second.
4. Put a required signature and date field on each signer’s section.
5. Confirm the document status cannot become `Completed` until both signatures are present.

### W-9 operational protection

The W-9 template is intentionally a secure-intake acknowledgment, not an imitation of the IRS form. Download the current official IRS Form W-9 at deployment time and collect it through an approved secure process. The IRS identifies Form W-9 as the form used to provide a correct taxpayer identification number to a requester that must file an information return; it publishes the current PDF on its Form W-9 page. Do not collect an SSN, EIN, routing number, or account number in a normal GHL document body, standard form, email, SMS, or this repository.

Before publishing this template, replace `[SECURE W-9 UPLOAD LINK]` with the approved secure upload destination. A completed acknowledgement alone does not mean that the tax form was received or verified.

---

## 2. Build the document-dispatch workflow

Create a workflow from scratch:

- **Workflow name:** `MCD - Agent Onboarding Documents`
- **Trigger:** Contact Tag
- **Tag:** `agent-approved`
- **Re-entry:** Disable routine re-entry to prevent accidental duplicate document sends. Use a deliberate separate resend process if a document must be reissued.

Immediately after the trigger, add these four **Send Document** actions with no delays:

1. Send `MCD - Sales Partner Agreement`.
2. Send `MCD - NDA / Confidentiality and IP Agreement`.
3. Send `MCD - W-9 / Payout Intake`.
4. Send `MCD - New Hire Acknowledgment`.

Optional visibility action after the four sends: add contact tag `onboarding-documents-sent`.

**Do not put the document-completion webhooks into this dispatch workflow.** The tag trigger sends documents; it does not reliably wait for individual signatures. Use the four completion workflows below so each document relays immediately upon that document’s completed status.

---

## 3. Build the four document-completion relay workflows

Create one workflow per template. Each workflow has its own document-completed trigger and its own webhook payload. Keeping them separate prevents one document’s completion from being blocked by another document that remains unsigned.

### Shared trigger configuration

For each relay workflow:

1. Create a new workflow from scratch.
2. Use the GHL **Documents & Contracts / Document Status** trigger for **Completed** status. The exact label can vary by GHL account version.
3. Filter the trigger to the exact template name shown below. Do not use a generic “any document completed” trigger without a template-name or template-ID filter.
4. Configure re-entry to allow a newly issued document instance to relay again. The MiniCRM should use `ghl_event_id` for idempotency, so an identical event is not double-counted.
5. Add **Custom Webhook** as the first action after the trigger.
6. Enter the shared URL and headers exactly as provided below.

### Shared webhook settings

- **Method:** `POST`
- **URL:** `https://crm.mercurycalldesk.com/api/ghl/documents`
- **Header 1:** `Content-Type` = `application/json`
- **Header 2:** `x-mcd-webhook-secret` = `[PASTE VERCEL GHL_WEBHOOK_SECRET]`

Use GHL’s merge-field picker to select the event, contact, and document values. The variable names below are the required MiniCRM payload keys. If your GHL screen offers a differently named token for the same document property, select the token shown in the picker; do not type a guessed token. Record any token mismatch for the developer before production activation.

### 3A. Sales Partner Agreement relay

- **Workflow name:** `MCD - Relay - Sales Agreement Completed`
- **Template filter:** `MCD - Sales Partner Agreement`
- **MiniCRM `document_type`:** `SALES_AGREEMENT`

```json
{
  "ghl_event_id": "{{event.id}}",
  "location_id": "lEdLVFW0uqKMhmkgFrsX",
  "ghl_contact_id": "{{contact.id}}",
  "document_type": "SALES_AGREEMENT",
  "status": "COMPLETED",
  "document_id": "{{document.id}}",
  "signer_ip": "{{document.signer_ip}}",
  "countersigned": true,
  "completed_at": "{{document.completed_at}}"
}
```

Optional visibility action: add tag `onboarding-sales-agreement-complete` after the webhook action. Do not treat that tag as proof of webhook delivery; use MiniCRM integration logs.

### 3B. NDA / Confidentiality and IP Agreement relay

- **Workflow name:** `MCD - Relay - NDA IP Completed`
- **Template filter:** `MCD - NDA / Confidentiality and IP Agreement`
- **MiniCRM `document_type`:** `NDA_IP`

```json
{
  "ghl_event_id": "{{event.id}}",
  "location_id": "lEdLVFW0uqKMhmkgFrsX",
  "ghl_contact_id": "{{contact.id}}",
  "document_type": "NDA_IP",
  "status": "COMPLETED",
  "document_id": "{{document.id}}",
  "signer_ip": "{{document.signer_ip}}",
  "countersigned": false,
  "completed_at": "{{document.completed_at}}"
}
```

Optional visibility action: add tag `onboarding-nda-ip-complete` after the webhook action.

### 3C. W-9 / Payout Intake relay

- **Workflow name:** `MCD - Relay - W9 Completed`
- **Template filter:** `MCD - W-9 / Payout Intake`
- **MiniCRM `document_type`:** `W9`

```json
{
  "ghl_event_id": "{{event.id}}",
  "location_id": "lEdLVFW0uqKMhmkgFrsX",
  "ghl_contact_id": "{{contact.id}}",
  "document_type": "W9",
  "status": "COMPLETED",
  "document_id": "{{document.id}}",
  "signer_ip": "{{document.signer_ip}}",
  "countersigned": false,
  "completed_at": "{{document.completed_at}}"
}
```

Optional visibility action: add tag `onboarding-w9-intake-complete` after the webhook action. Maintain a separate internal checklist or MiniCRM status for “official W-9 received and verified.”

### 3D. New Hire Acknowledgment relay

- **Workflow name:** `MCD - Relay - New Hire Acknowledgment Completed`
- **Template filter:** `MCD - New Hire Acknowledgment`
- **MiniCRM `document_type`:** `ACKNOWLEDGMENT`

```json
{
  "ghl_event_id": "{{event.id}}",
  "location_id": "lEdLVFW0uqKMhmkgFrsX",
  "ghl_contact_id": "{{contact.id}}",
  "document_type": "ACKNOWLEDGMENT",
  "status": "COMPLETED",
  "document_id": "{{document.id}}",
  "signer_ip": "{{document.signer_ip}}",
  "countersigned": false,
  "completed_at": "{{document.completed_at}}"
}
```

Optional visibility action: add tag `onboarding-acknowledgment-complete` after the webhook action.

---

## 4. Phase 1.5 — Booking and calendar relay

Complete this before enabling live lead flow.

### Calendar setup

1. In **Settings → Integrations**, connect `mcd@gmail.com`.
2. In **Calendars → Calendar Settings**, create `MCD Demo`.
3. Set meeting location to Google Meet.
4. Assign the calendar to the designated booking user.
5. Under **Forms & Payment**, enable **Add Guests**.
6. Enable notifications for Contact, Guests, Users, and Additional Emails.

### Appointment relay workflow

Create `MCD - Appointment Relay`.

- **Primary trigger:** Customer Booked Appointment for `MCD Demo`.
- **Additional branches / status paths:** Confirmed, Rescheduled, Cancelled, No-Show, and Completed.
- **Action:** Custom Webhook, `POST`.
- **URL:** `https://crm.mercurycalldesk.com/api/ghl/appointments`
- **Headers:** use the same two headers from the document relay.

Use one path per event type and set `[INSERT EVENT TYPE]` as follows:

| GHL event | `event_type` |
| --- | --- |
| Booked | `APPOINTMENT_BOOKED` |
| Confirmed | `APPOINTMENT_CONFIRMED` |
| Rescheduled | `APPOINTMENT_RESCHEDULED` |
| Cancelled | `APPOINTMENT_CANCELLED` |
| No-show | `APPOINTMENT_NO_SHOW` |
| Completed | `APPOINTMENT_COMPLETED` |

```json
{
  "ghl_event_id": "{{event.id}}",
  "location_id": "lEdLVFW0uqKMhmkgFrsX",
  "event_type": "[INSERT EVENT TYPE]",
  "ghl_contact_id": "{{contact.id}}",
  "ghl_appointment_id": "{{appointment.id}}",
  "starts_at": "{{appointment.start_time}}",
  "mini_crm_lead_id": "{{contact.mini_crm_lead_id}}"
}
```

---

## 5. Phase 2 — record now; do not activate commissions yet

Before enabling financial automations, create these Contact custom fields in **Settings → Custom Fields** and provide their generated GHL Field IDs to the developer:

| Label | Key |
| --- | --- |
| Mini CRM Lead ID | `mini_crm_lead_id` |
| Mini CRM Agent ID | `mini_crm_agent_id` |
| Originating Agent ID | `originating_agent_id` |
| Mini CRM Client Account ID | `mini_crm_client_account_id` |

Do not enable commission calculations until funding, invoice, and opportunity relays have been validated against the MiniCRM.

---

## 6. Phase 1 test protocol

1. Use a fresh test contact and complete the MiniCRM signup at `https://crm.mercurycalldesk.com/signup`.
2. Approve the applicant in the MiniCRM and confirm the `agent-approved` tag is applied in GHL.
3. Confirm all four GHL documents are sent.
4. Sign the NDA, W-9/Payout Intake acknowledgement, and New Hire Acknowledgment as the agent.
5. Sign the Sales Partner Agreement as the agent, then complete the Company countersignature from `info@mercurycalldesk.com`.
6. After **each** document completes, check that the appropriate MiniCRM document record appears and inspect `https://crm.mercurycalldesk.com/admin/integrations/errors` for failed or malformed payloads.
7. Confirm the Sales Agreement relay shows `countersigned: true`; confirm the other three show `false`.
8. Reissue one document to the same test contact and complete it again. Confirm that the new GHL event is accepted once and that duplicate delivery of the same `ghl_event_id` does not create duplicate MiniCRM records.

## 7. Pre-production release checklist

- [ ] Legal entity, governing law, notices, and company address are finalized in all templates.
- [ ] Counsel or a qualified local professional has reviewed the agreements.
- [ ] The current official IRS Form W-9 has been downloaded and secure collection is operational.
- [ ] The live webhook secret is set in Vercel and pasted only in GHL headers.
- [ ] Every document-completion workflow filters to one exact template.
- [ ] The MiniCRM has validated the final merge-field payloads from a live GHL test.
- [ ] `/admin/integrations/errors` is clear for the test contact.
- [ ] Document and payout access are limited to authorized users only.
