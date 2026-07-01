# Mercury Call Desk — GHL Phase 1: Agent Onboarding

> **Working GHL renditions — attorney review required before production use.** These files are derived from the business-approved MCD source materials in `hpintojr/My-Workspace`, but remain legal drafts until California counsel approves final signature language and workflow.

## Contracting identity

| Item | Approved value |
| --- | --- |
| Contracting company | **Charter Oaks Assets, Inc. d/b/a Mercury Call Desk** |
| Authorized signer | **Hamilton Pinto Jr., Manager and Authorized Signatory** |
| Business address | **231 E Alessandro Blvd A-208, Riverside, CA 92508** |
| Program | **Independent Sales Partner Program** |
| Partner relationship | Commission-only 1099 Independent Sales Partner |
| Governing law | California |
| Civil-dispute forum | Individual binding JAMS arbitration in Riverside County, California, subject to final counsel review |

## Source-of-truth mapping

Do not change pricing, lead attribution, client servicing, commission terms, CRM access rules, agreement provisions, or compliance language without first comparing the change against these source files in `hpintojr/My-Workspace`:

| GHL upload rendition | Authoritative workspace source |
| --- | --- |
| `01-sales-partner-agreement.md` | `02 Projects/MCD - Mercury Call Desk/01-agent-onboarding/agreements/[C] Sales Partner Agreement (DRAFT).md` |
| `02-nda-confidentiality-ip-agreement.md` | `02 Projects/MCD - Mercury Call Desk/01-agent-onboarding/agreements/[C] Confidentiality and IP Agreement (DRAFT).md` |
| `03-w9-payout-intake.md` | Mandatory W-9 requirement in `02 Projects/MCD - Mercury Call Desk/[C] Partner Program Business Terms — Approved 2026-06-30.md` |
| `04-new-hire-acknowledgment.md` | `02 Projects/MCD - Mercury Call Desk/01-agent-onboarding/12_NEW_HIRE_ACKNOWLEDGMENT.md` |
| `05-ghl-phase-1-runbook.md` | GHL implementation contract plus the MCD business terms above |

## What this folder contains

| File | Use in GHL | Recipient setup |
| --- | --- | --- |
| `01-sales-partner-agreement.md` | Sales Partner Agreement | Agent + company countersigner |
| `02-nda-confidentiality-ip-agreement.md` | NDA / Confidentiality and IP Agreement | Agent only for Phase 1 GHL workflow |
| `03-w9-payout-intake.md` | W-9 / Payout Intake acknowledgement | Agent only |
| `04-new-hire-acknowledgment.md` | New Hire Acknowledgment | Agent only |
| `05-ghl-phase-1-runbook.md` | Admin build guide, workflows, webhook payloads, and testing | Internal only |

## Mandatory gates

An applicant is **not active** merely because the `agent-approved` tag was applied. The tag only begins onboarding. Before Hamilton countersigns the Sales Partner Agreement and the MiniCRM grants active access, the Partner must complete:

1. Complete CRM profile with verified personal email, mobile number, mailing address, and required contact information.
2. Official current IRS Form W-9 through the approved secure process.
3. Signed Sales Partner Agreement.
4. Signed Confidentiality and Intellectual Property Agreement.
5. CRM training/check-in.

Live lead claiming or live outreach remains separately gated by certification and compliance approval. The source onboarding scorecard and manager checklist control those later permissions.

## Required completion before publishing

- Have California counsel review the final 1099/independent-contractor structure, arbitration, commission/residual terms, cancellation language, corporate-signature language, and each state-specific notice needed.
- Confirm GHL document fields, signer order, and completion triggers in a live test; GHL merge-field token labels may differ from the names used in the runbook.
- Download the current official IRS Form W-9 at deployment time. The W-9 file in this folder is a secure-intake acknowledgement, not a substitute for the official IRS form.
- Store `GHL_WEBHOOK_SECRET` only in Vercel and paste it directly into GHL’s webhook header configuration. Never commit it.
- Do not store taxpayer identification numbers, routing numbers, or bank-account numbers in ordinary GHL documents, email, SMS, workflow notes, screenshots, or this repository.

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

GHL is the document-delivery and signature system. The MiniCRM integration endpoint is the event ledger. A GHL contact tag or document-completion tag is useful for visibility but is not proof that a relay webhook was accepted. Confirm delivery and payload errors in `crm.mercurycalldesk.com/admin/integrations/errors` during testing.
