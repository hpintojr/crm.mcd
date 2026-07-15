# Agent Activation Gates

**Status:** Built; the additive database migration (`prisma/migrations/20260714120000_add_agent_activation_gates`) must be applied to production, with explicit owner authorization, before this change set may deploy.

## Authoritative rule

Per `docs/ghl/phase-1/06-mcd-source-alignment-and-phase-1-gates.md`, completed GHL documents alone never make a Sales Partner active. Before the MiniCRM issues a provisioning activation email it requires documented proof of all of the following:

1. Approved applicant (`Agent.status = APPROVED`).
2. All four onboarding documents completed, with the Sales Partner Agreement countersigned.
3. Internal confirmation that the official W-9 was received through the approved secure intake (`w9VerifiedAt`).
4. Verified profile completeness (`profileCompletedAt`).
5. CRM training / check-in completion (`trainingCompletedAt`).

## Design

- **Evidence, not stored status.** Each internal gate is a nullable timestamp plus the recording admin's user id on `Agent`. The activation state (`APPLICANT_IN_REVIEW → DOCUMENTS_IN_PROGRESS → DOCUMENTS_COMPLETE → W9_VERIFIED → PROFILE_COMPLETE → TRAINING_COMPLETE → ACTIVE_PARTNER`) is derived by the pure policy helper `src/lib/agent-activation-policy.ts` and is never persisted, so it cannot drift from its evidence.
- **Provisioning boundary.** `/api/ghl/documents` now consults the policy before creating a User and sending the activation email. When internal gates are missing, the webhook records the document event as before and reports `activationState` and `missingInternalGates` in its response without provisioning.
- **Admin recording.** `/admin/agents/:id/onboarding` gains an "Internal activation gates" section. Recording or clearing a gate requires a note and writes an `AGENT_ACTIVATION_GATE_RECORDED` / `AGENT_ACTIVATION_GATE_CLEARED` audit entry.
- **Grandfathering (owner decision, 2026-07-14).** Agents provisioned before these gates existed keep their access; the policy reports `ACTIVE_PARTNER` for any provisioned agent and the gate applies at first provisioning only. Their evidence fields stay null until an admin records them.
- **No sensitive data.** Only timestamps, actor ids, and audit notes are stored. No tax forms, tax identifiers, banking data, or document contents enter the MiniCRM.

## Guard coverage

`scripts/check-agent-activation-policy.ts` (run in CI via the Agent Activation Policy workflow and `npm run check:agent-activation-policy`) asserts every state transition, that internal gates alone never issue activation, and the grandfathering behavior.

## Rollout sequence

1. Rehearse the additive migration on a disposable Neon branch.
2. Obtain explicit owner authorization for the production apply.
3. Apply the columns to production (nullable and additive; invisible to the running application).
4. Merge this change set; Vercel deploys with the columns already present.

Do not merge before step 3: the Prisma client selects all model columns, so deploying this code against a database without the new columns would break Agent reads.
