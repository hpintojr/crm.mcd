# Lead MVP Rollout Status

**Status:** Built, deployed, and held behind the Lead feature gate  
**Last updated:** July 2, 2026  
**Activation state:** `LEADS_ENABLED=false` — agents cannot access Lead workflows yet.

## What is complete

### Production database

The Lead MVP schema has been applied and validated in Neon production.

- Lead, LeadClaimEvent, LeadActivity, LeadNote, LeadCallback, and LeadSuppression tables are present.
- Lead ownership, activity, callback, suppression, and claim relationships are in place.
- Required indexes for active-work queues, callbacks, dedupe, suppression, source tracking, website review, and appointment references are present.
- Lead source taxonomy, referral, UTM, campaign, website-opportunity, and dedupe fields are present.
- Production schema-release records document the baseline and Lead MVP rollout.
- No production test leads were intentionally inserted during the schema rollout.

> Do not run a blanket `prisma migrate deploy` against production. The production baseline is governed through the documented Neon safety-branch and explicit-production-apply process.

### Agent workflow

The deployed Lead workspace includes:

- Atomic Open Pool claims.
- Agent-owned active-record list and selected-record detail view.
- Activity and outcome logging.
- Note history and callback history.
- Pacific-time callback scheduling; newer callbacks close prior scheduled callbacks for that agent and record.
- Immediate DNC handling that suppresses the Lead, cancels scheduled callbacks, creates a suppression record, and writes activity/audit history.
- Invalid-number and out-of-business suppression.
- Server-side ownership validation: agents can only act on records assigned to them.
- Certification control: an agent must be approved to claim Lead records.

### Admin import and review workflow

The deployed control path includes:

- `POST /api/admin/leads/import` for admin-authenticated JSON batch imports.
- Maximum batch size of 500 rows.
- Source and intake validation before a row can be accepted.
- Google Maps batch scrape/import protection is enforced by source policy.
- Duplicate-in-batch and existing-CRM dedupe checks.
- Active suppression/DNC screening before database insertion.
- New imports are created as `PENDING_REVIEW`; they do **not** enter an agent workspace automatically.
- Admin review actions: approve to managed pool, disqualify with reason, or suppress for compliance with reason.

### Open Pool protection

New imports cannot be approved directly into Open Pool.

Open Pool is reserved for a documented return of an already assigned record. A return requires:

1. A non-suppressed, non-DNC Lead.
2. A non-referral Lead.
3. A Lead that is not `DEMO_BOOKED`.
4. Prior agent ownership.
5. Documented two-way contact.
6. An eligible lifecycle state: `CLAIMED`, `CONTACTED`, or `NURTURING`.
7. An admin-entered return reason.
8. Claim, activity, and audit records.

This preserves referral protection, demo-booked protection, and prevents untouched new records from being exposed as agent claim opportunities.

### GHL appointment attribution

The existing verified GHL appointment webhook now also attempts Lead attribution when Leads are enabled.

- First match: `mini_crm_lead_id` supplied in the event payload.
- Fallback match: existing Lead with matching `ghl_contact_id`.
- Booked, confirmed, and rescheduled events update the matching Lead to `DEMO_BOOKED`.
- Cancelled and no-show events return the matching Lead to a follow-up state and create a callback for its existing owner.
- Attribution does not transfer ownership to a different agent.
- Every attributed event writes Lead activity and audit history.
- Unmatched appointment events remain recorded in the existing appointment/webhook workflow without creating a new Lead.

## Production deployment

- Production branch: `main`
- Latest verified production deployment: Vercel deployment `dpl_3Eticvc9Fktj4QosV1nKxJPwca1n`
- Deployment state: `READY`
- Latest deployed commit: `92f094041dce4aa1eb447f9fd9180b3ec2426844`
- Runtime error/fatal log check after the prior Lead MVP deployment: no matching logs returned.

## Deliberately not enabled or started

- `LEADS_ENABLED` remains `false` pending owner acceptance testing.
- No marketing or sales outreach has been started from this module.
- No automatic outbound GHL booking creation has been enabled. The incoming appointment relay is implemented; the outbound endpoint contract still requires a controlled GHL implementation decision.
- `SERVICING_ENABLED`, `COMMISSIONS_ENABLED`, and `FINANCE_ENABLED` remain disabled.
- Client servicing health, commission ledger, and payout automation have not been activated.

## Required acceptance-test gate

Read and execute [Lead MVP Acceptance Test](./LEAD_MVP_ACCEPTANCE_TEST.md) before changing `LEADS_ENABLED` to `true`.

Activation is approved only when every blocking test passes and the owner confirms that the first live batch may be used.

## Next phase after acceptance

**Client Servicing Health** begins only after the Lead MVP is stable. Its scope is:

- Client account records and health signals.
- Triggered servicing activity instead of mandatory routine quarterly check-ins for healthy, current-paying clients.
- Service response, payment issue, renewal, escalation, and resolution tracking.
- Account reassignment controls that preserve commissions for good-standing agents who continue servicing their clients.
- House-account transfer controls where service responsibility is declined or an agent loses future commission eligibility.
