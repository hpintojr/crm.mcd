# MCD Source Alignment and Phase 1 Activation Gates

This note prevents the GHL document workflow from being treated as the entire MCD activation process.

## Authoritative business rule

The approved MCD business terms require all of the following before Hamilton countersigns and active MiniCRM/GHL access is granted:

1. Complete CRM profile with verified personal email, mobile number, mailing address, and required contact information.
2. Official current IRS Form W-9 through the approved secure intake process.
3. Signed Sales Partner Agreement.
4. Signed Confidentiality and Intellectual Property Agreement.
5. CRM training/check-in completion.

A Sales Partner may be active yet still be blocked from live leads until certification and compliance authorization are complete.

## What the Phase 1 GHL workflows do

| Phase 1 item | Purpose | Does this alone make the Partner active? |
| --- | --- | --- |
| `agent-approved` tag | Applicant approved to begin onboarding | No |
| Four Send Document actions | Delivers agreements and acknowledgements | No |
| Document-completed webhook | Records signature completion in MiniCRM | No |
| Sales Agreement Company countersignature | Satisfies the contract countersignature condition | Not by itself |
| Official W-9 secure intake and verification | Satisfies tax-documentation condition | Not by itself |
| Profile complete + CRM training/check-in | Satisfies onboarding requirements | Not by itself unless MiniCRM validates all gates |
| Certification scorecard / compliance approval | Releases lead-claim or live outreach rights | No, it affects lead authority |

## Required MiniCRM validation behavior

Before the MiniCRM issues an activation email, marks the Partner active, or gives an operational role, it should require documented proof of:

- completed Sales Partner Agreement with `countersigned: true`;
- completed NDA/IP Agreement;
- completed W-9 secure-intake acknowledgement **and** an internal confirmation that the official W-9 was received securely;
- completed onboarding acknowledgment;
- verified profile; and
- CRM training/check-in completion.

The existing document relay only proves the document event. It does not prove W-9 validation, profile completion, training, certification, DNC/compliance clearance, or lead eligibility unless those checks are separately implemented.

## Current Phase 1 implementation decision

Use `agent-approved` as an **onboarding-start** tag, not an active-status tag.

Maintain these separate internal status values in the MiniCRM or GHL until the full automation exists:

- `APPLICANT_APPROVED`
- `DOCUMENTS_IN_PROGRESS`
- `DOCUMENTS_COMPLETE`
- `W9_VERIFIED`
- `PROFILE_COMPLETE`
- `TRAINING_COMPLETE`
- `ACTIVE_PARTNER`
- `CERTIFIED_FOR_LEADS`

Do not assign lead-claim, OpenPool, Shark Tank, exports, billing, workflow, settings, or administrative access merely because a document webhook was received.

## Source documents used

- `hpintojr/My-Workspace/02 Projects/MCD - Mercury Call Desk/[C] Partner Program Business Terms — Approved 2026-06-30.md`
- `hpintojr/My-Workspace/02 Projects/MCD - Mercury Call Desk/01-agent-onboarding/00_READ_ME_FIRST.md`
- `hpintojr/My-Workspace/02 Projects/MCD - Mercury Call Desk/01-agent-onboarding/09_CERTIFICATION_SCORECARD.md`
- `hpintojr/My-Workspace/02 Projects/MCD - Mercury Call Desk/01-agent-onboarding/11_MANAGER_CHECKLIST.md`
