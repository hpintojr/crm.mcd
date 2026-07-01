# Mercury Call Desk — GHL Phase 1: Agent Onboarding

> **Working templates — legal and tax review required before production use.** Replace every bracketed placeholder before publishing the templates in GoHighLevel (GHL). Do not place the GHL webhook secret, a taxpayer identification number, bank account number, or routing number in this repository or a standard document template.

## What this folder contains

| File | Use in GHL | Recipient setup |
| --- | --- | --- |
| `01-sales-partner-agreement.md` | Sales Partner Agreement | Agent + company countersigner |
| `02-nda-confidentiality-ip-agreement.md` | NDA / Confidentiality and IP Agreement | Agent |
| `03-w9-payout-intake.md` | W-9 / Payout Intake acknowledgement | Agent |
| `04-new-hire-acknowledgment.md` | New Hire Acknowledgment | Agent |
| `05-ghl-phase-1-runbook.md` | Admin build guide, workflows, webhook payloads, and testing | Internal only |

## Required completion before publishing

- Confirm the company’s **legal entity name**, business address, notice email, and governing-law state.
- Confirm the current commission plan, payout cadence, chargeback/refund treatment, and any package-specific rate cards.
- Have counsel confirm the independent-contractor classification, commission-continuation terms, IP assignment, confidentiality obligations, and jurisdiction-specific notices.
- Download the **current official IRS Form W-9** at the time of deployment. The W-9 template in this folder is a secure-intake and payout acknowledgement; it is not a substitute for the official IRS form.
- Store `GHL_WEBHOOK_SECRET` only in Vercel and paste it directly into GHL’s webhook header configuration. Never commit it.

## GHL template names

Create the templates with these exact names so the completion workflows can filter by template title:

1. `MCD - Sales Partner Agreement`
2. `MCD - NDA / Confidentiality and IP Agreement`
3. `MCD - W-9 / Payout Intake`
4. `MCD - New Hire Acknowledgment`

## Canonical document types

| Template | `document_type` |
| --- | --- |
| Sales Partner Agreement | `SALES_AGREEMENT` |
| NDA / Confidentiality and IP Agreement | `NDA_IP` |
| W-9 / Payout Intake | `W9` |
| New Hire Acknowledgment | `ACKNOWLEDGMENT` |

## Source-of-truth rule

GHL is the document-delivery and signature system. The MiniCRM endpoint is the integration ledger. A GHL contact tag or document-completion tag is helpful for visibility but must not be treated as proof that the relay webhook was successfully accepted. Confirm delivery and payload errors in `crm.mercurycalldesk.com/admin/integrations/errors` during testing.
