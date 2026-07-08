# CRM.MCD Lead Flow Alignment — 2026-07-08

## Purpose

This document records the Lead workspace alignment after the July 8, 2026 production data correction moved the initial 50 imported leads out of Open Pool and into Cold Leads.

The build now follows the Section 17 decisions:

- Call attempt creates activity only; no soft lock.
- Callback before two-way contact does not reserve a lead.
- Agents cannot claim before two-way contact.
- DNC is an absolute blackout.
- The 45-day responsibility timer starts on claim.
- The original 50 imported leads were corrected out of Open Pool.

## Production data correction completed

Batch corrected:

```text
cmrbj55go0000la04pxcuuaci
```

Local run:

```text
RUN_2026_07_08_e8a9beed
```

Final production state after correction:

```text
50 leads = COLD / AVAILABLE
0 leads = OPEN / AVAILABLE / claimable
```

The correction used the current deployed Prisma enum model. `VALIDATED` does not exist in the current `LeadLifecycle` enum, so the compatible state is:

```text
pool = COLD
lifecycle = AVAILABLE
ownerAgentId = null
openPoolReleaseAt = null
```

Audit evidence created:

- 1 `LEAD_BATCH_POOL_CORRECTED` `AuditLog` record.
- 50 `LEAD_POOL_CORRECTED` `AuditLog` records.

## Code alignment in this branch

Branch:

```text
lead-flow-alignment-20260708
```

### Cold Lead workspace

`/portal/leads` now includes a Cold Lead workspace path:

- Lists `COLD / AVAILABLE` unowned records.
- Opens an unowned lead detail panel with research fields.
- Provides a dial link and explicit call-start logging.
- Logs call attempts as activity only.
- Provides a post-call disposition gate for Cold Leads.

### Call attempt rule

Cold Lead call-start logging writes:

- `LeadActivity.type = CALL_INITIATED`
- `AuditLog.actionType = COLD_LEAD_CALL_INITIATED`

It does not set:

- `ownerAgentId`
- `claimedAt`
- `openPoolReleaseAt`

### Disposition rule

Cold Lead disposition outcomes:

| Disposition | Result |
|---|---|
| `NO_ANSWER` | Remains `COLD / AVAILABLE`; no ownership |
| `VOICEMAIL` | Remains `COLD / AVAILABLE`; no ownership |
| `CALLBACK_REQUESTED` | Moves to `NURTURE / NURTURING`; two-way contact recorded; claim eligible |
| `QUALIFIED` | Moves to `HOT / CONTACTED`; two-way contact recorded; claim eligible |
| `FOLLOW_UP` | Moves to `HOT / CONTACTED`; two-way contact recorded; claim eligible |
| `NOT_INTERESTED` | Moves to `CLOSED_LOST`; no ownership |
| `WRONG_NUMBER` | Moves to `DISQUALIFIED` and suppressed |
| `OUT_OF_BUSINESS` | Moves to `DISQUALIFIED` and suppressed |

Callback scheduling before claim creates callback work only. It does not reserve ownership.

### Claim rule

`claimAvailableLead` now requires:

- lead is unowned;
- lead is not DNC/suppressed;
- lead is in `HOT` or `NURTURE`;
- lead lifecycle is `CONTACTED`, `NURTURING`, or `DEMO_BOOKED`;
- `twoWayContactAt` is present.

When claim succeeds:

- `ownerAgentId` is set;
- `lifecycle` becomes `CLAIMED`;
- `claimedAt` is set;
- `openPoolReleaseAt` is set to 45 days after claim;
- `LeadClaimEvent`, `LeadActivity`, and `AuditLog` are written.

### Aging sweep

A secured cron endpoint was added:

```text
/api/cron/leads/aging
```

It is configured in `vercel.json` to run daily at 12:00 UTC and requires:

```text
Authorization: Bearer $CRON_SECRET
```

The sweep performs two controlled jobs:

1. **45-day claim expiration**
   - Finds claimed/contacted/nurturing, non-referral, non-suppressed Leads whose `openPoolReleaseAt` has passed.
   - Clears ownership and returns the Lead to `OPEN / AVAILABLE`.
   - Writes `LeadClaimEvent`, `LeadActivity`, and `AuditLog` evidence.

2. **21-day Open Pool stall promotion**
   - Finds unowned `OPEN / AVAILABLE` Leads that have remained released for 21 days.
   - Moves them to `SHARK_TANK`.
   - Writes `LeadActivity` and `AuditLog` evidence.

### DNC rule

DNC can be applied from both unowned Cold Lead flow and owned Lead flow. It suppresses the record, cancels scheduled callbacks, and records absolute-blackout metadata.

## Guard check

A build guard was added:

```text
scripts/check-lead-flow-alignment.ts
```

It verifies that the code still contains the key Cold Lead, no-claim-before-contact, aging-sweep, and cron safeguards.

## Still gated / not completed in this branch

- Full client-side `tel:` interception is not yet implemented; the current branch uses a dial link plus explicit call-start logging.
- Commission and Finance remain gated and intentionally untouched.
- Production feature-gate values and `CRON_SECRET` must be verified before rollout.

## Acceptance checks to run next

- Cold Lead appears after production correction.
- Clicking/logging call start does not claim the lead.
- No-answer disposition keeps lead unowned.
- Callback disposition creates claim eligibility but does not auto-claim.
- Claim succeeds only after two-way contact.
- Claim sets a 45-day `openPoolReleaseAt`.
- DNC suppresses and cancels callbacks.
- Aging sweep returns expired owned leads to Open Pool.
- Aging sweep moves 21-day stale Open Pool leads to Shark Tank.
