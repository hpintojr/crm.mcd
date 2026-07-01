# MCD CRM — Build Specs Index & Roadmap
**Date:** 2026-06-30 · **Read first:** `[C] AI Handoff & Scope Review.md`
**How to use:** Build slices in order. Each slice has its own spec doc (full detail) or an outline here (expand to full on request). ChatGPT builds one slice per branch/PR; Claude reviews against the spec's acceptance criteria; Hamilton commits/pushes.

## Status legend
`DONE` shipped · `SPEC` full spec written · `OUTLINE` scoped here, expand before building · `LATER` phase 3/4.

## Slice map
```txt
00  Foundation + public signup → GHL ............ DONE  (in repo)
01  Auth.js v5 (login, roles, MFA, activation) .. SPEC  [C] Build Spec 01 — Auth.js v5 Foundation.md
02  Admin applicant review + GHL approve tag .... SPEC  [C] Build Spec 02 …
03  Inbound GHL webhooks + provisioning ......... SPEC  [C] Build Spec 03 …
04  Agent portal + Stripe Connect onboarding .... SPEC  [C] Build Spec 04 …
05  Certification + activation gating ........... OUTLINE (§05)
06  Leads engine: pools, atomic claim, rules .... OUTLINE (§06)
07  Lead workspace: call/disposition/callback ... OUTLINE (§07)
08  Demo booking handoff to GHL ................. OUTLINE (§08)
09  Funding relay + commission engine ........... OUTLINE (§09)
10  Client accounts + servicing cadence ......... OUTLINE (§10)
11  Finance: payout batches + Stripe payouts .... OUTLINE (§11)
12  Lead ingestion (Python) + Sequenzy nurture .. OUTLINE (§12)
13  Compliance/DNC + audit viewer + retention ... OUTLINE (§13)
14  Admin Command Center + reporting + alerts ... OUTLINE (§14)
15  System settings, feature flags, seed, tests . OUTLINE (§15)
```

Dependency notes: 02→needs 01. 03→needs 01,02. 04→needs 01,03. 06→needs 05. 07→needs 06. 08→needs 06. 09→needs 08 (+03 webhooks). 10→needs 09. 11→needs 09,10. 12 can run parallel after 06. 13 threads through all. 14 after 06/09. 15 last.

---

## §05 — Certification + activation gating  (OUTLINE)
```txt
Goal: manager-signed Certification Scorecard → flips can_claim_leads; admin activation checklist gate.
Model: extend Certification (already present) — add coaching task; Agent.canClaimLeads already exists.
       Add ActivationChecklist (agent_id, item_key, checked_by, checked_at) mirroring 11_MANAGER_NEW_HIRE_CHECKLIST.
Files: src/app/admin/agents/[id]/certify (manager scorecard form: product/discovery/crm/compliance + decision),
       src/app/admin/agents/[id]/activate (checklist), server actions writing audit + flipping flags.
Rules: ACTIVE != can_claim_leads; APPROVED_FOR_LIVE → true; WITH_COACHING → true + coaching task; NOT_YET → false.
       Countersignature (Hamilton) required before ACTIVE (ties to 03/04).
Accept: certify writes record + flips flag + audit; agent blocked from lead pools until certified; checklist gates activation.
```

## §06 — Leads engine: pools, atomic claim, protection rules  (OUTLINE)
```txt
Goal: the core prospecting engine + the approved lead-protection rules.
Model: Lead (company, contacts, business_phone, industry, location, timezone, source, score, status, pool,
       owner_agent_id, activity_state, is_referral, referral_source, two_way_contact_at, suppressed, dnc,
       created_at, last_action_at, next_action_at); LeadClaimEvent; LeadAssignment; LeadActivity; LeadNote;
       LeadCallback; LeadDisposition; LeadSuppression; enums for lifecycle/pool/ownership/activity (scope §8).
Rules (v1.2): cold protected only after two_way_contact_at set; referral protected on entry; OpenPool releases
       cold lead with no demo after 45 days (configurable); Shark Tank pool gated to top_tier_closer capability;
       credit provisional until CLOSED_WON + cleared payment. Atomic claim in a DB transaction (only one wins);
       capacity limits per pool; SLA timers (configurable).
Endpoints/actions: claimLead (transaction), releaseLead, reassign (admin), returnToPool jobs.
Accept: two agents claim same lead → one wins, other gets clear message; 45-day OpenPool release works; capacity
       enforced; suppressed/DNC cannot be claimed; every transition audited.
```

## §07 — Lead workspace: call / disposition / callback  (OUTLINE)
```txt
Goal: the agent's per-lead work surface (scope §11.3–11.5).
Model: reuse §06 tables; add Disposition enum (NO_ANSWER…DEMO_BOOKED…DO_NOT_CONTACT).
Files: src/app/portal/leads/[id] (left info + compliance warnings, main call/email/script/disposition/next-action,
       right timeline). Click-to-call = tel: on mobile + copy-number on desktop; record CALL_INITIATED immediately;
       require disposition + note + next action after a call. Approved script panel from the KB (06_OUTBOUND_CALL_SCRIPT).
Rules: business-phone dialing only; recording disclosure surfaced; DNC/opt-out one tap → suppress + log within 24h.
Accept: call logs CALL_INITIATED; disposition/note required; callback creates a reminder; agent sees only permitted leads.
```

## §08 — Demo booking handoff to GHL  (OUTLINE)
```txt
Goal: book a demo → create/update GHL contact+opportunity+appointment, stamp attribution, run post-book workflow.
Uses: [C] GHL Backend Integration Spec.md §5 + [C] GHL Booking Sequence.svg. Calendar = mcd@gmail (free Gmail) via GHL,
      Add Guests = agent; app holds the token (agents never touch GHL).
Files: server action bookDemo → ghl.upsertContact + createOpportunity + createAppointment (custom fields:
      mini_crm_agent_id, originating_agent_id, set_pricing_tier); store ghl_links; lead → DEMO_BOOKED.
Inbound: /api/ghl/appointments (booked/confirmed/rescheduled/cancelled/no-show/completed) → update booking; no-show → recovery queue.
Accept: booking creates the 3 GHL records + stores ids; reschedule preserves original booking credit; no-show → recovery.
```

## §09 — Funding relay + commission engine  (OUTLINE — high value)
```txt
Goal: Stripe→GHL→CRM funding events drive the 50/50 Net Commissionable Profit ledger.
Model: Package (code, retail, wholesale), CommissionPlan + CommissionPlanVersion + CommissionRule,
       CommissionLedgerEntry (all fields per scope §20), WebhookEvent (idempotency), IntegrationError.
Endpoint: /api/ghl/funding (FUNDED/FUNDING_FAILED/REFUND/DISPUTE) — shared-secret + location allowlist + idempotency.
Payload adds: processing_fee, tax_amount, package_code (per v1.2 §1). Formula: 0.5 * (collected − wholesale − fee); tax excluded.
Setup-fee commission: cover first-month wholesale+fee, remainder 50/50, min setup-profit per package.
Rules: create ledger from ACTUAL collected; PENDING→hold per plan; refund/dispute → ON_HOLD (never auto-clawback);
       payout SLAs (new 30d + launch checklist / established 15d); commission plan versioned (no retro recalculation).
Accept: dup webhook → no dup commission; recurring charge → new residual entry; refund → ON_HOLD; net math correct.
```

## §10 — Client accounts + servicing cadence  (OUTLINE)
```txt
Goal: post-close client accounts + the MANDATORY per-package service cadence (v1.2 §3).
Model: ClientAccount (linked lead/ghl/stripe refs, contract type/dates, originating_agent, servicing_agent,
       house_account_id, health, last_payment, renewal_date), ServiceTask, ServiceEvent, HealthRecord,
       cadence config per package, violation counter (rolling 12 mo).
Rules: cadence Starter biweekly→monthly, Growth weekly→biweekly/monthly, Pro/Ent weekly + guaranteed 1-hr weekly;
       60-day no-health-confirm = violation (1st warning, 2nd/12mo → House); 3-day no-response+escalate → termination review.
       Replaces old §12.3 "no forced activity". Documented meeting offer/decline counts as compliant.
Accept: cadence tasks generate on schedule; 60-day violation warns then moves to House on 2nd; residual ends on House move.
```

## §11 — Finance: payout batches + Stripe payouts + 1099  (OUTLINE)
```txt
Goal: Finance approval + actual payouts via Stripe Connect; offset/repayment; reporting.
Model: PayoutBatch, Payout, Clawback/Adjustment; Agent.stripeConnectId + payouts_enabled.
Rules: calculate automatically, NEVER auto-pay without Finance approval (scope §17.9); refund/chargeback → hold/offset
       future commissions, 10-day repay window, 30-day dispute (CRM notes controlling). Stripe handles 1099.
Files: src/app/admin/finance (eligible ledger, approve → batch → Stripe transfer; exposure/holds views).
Accept: payout requires Finance approval; offset math correct; Connect payout only when payouts_enabled.
```

## §12 — Lead ingestion (local Python) + Sequenzy nurture  (OUTLINE)
```txt
Goal: local Python scraper/enrichment writes validated leads into Neon; nurture via Sequenzy.
Parts: /workers (Python) — scrape → normalize → dedupe → suppress-check → validate → score → insert as RAW/PENDING_REVIEW.
       Admin review queue approves → Cold pool or Sequenzy campaign. Provider abstraction (Sequenzy primary, Mailjet fallback):
       create_contact/update/suppress/add_to_campaign/remove/pause/resume/receive events. Define the Sequenzy campaign + workflow + suppression sync.
Rules: no lead available to agents/campaigns until validation gates pass (scope §9.3); transparent 0–100 score.
Accept: python insert appears in review queue; approve routes correctly; unsubscribe suppresses; dup import flagged.
```

## §13 — Compliance/DNC + audit viewer + retention  (OUTLINE)
```txt
Goal: the compliance backbone threaded through everything.
Model: Suppression/DNC list, ConsentRecord, opt-out log; AuditLog viewer (admin/compliance).
Rules: DNC = total blackout (calls/SMS/sales+marketing email/social DMs); transactional/billing/security may continue;
       log any opt-out within 24h; internal suppression blocks claim + campaign; 7-year retention + purge job + legal hold.
Accept: DNC lead cannot be claimed/enrolled; opt-out logged + honored; audit viewer filters by actor/entity; retention job runs.
```

## §14 — Admin Command Center + reporting + alerts  (OUTLINE)
```txt
Goal: the ops cockpit (scope §13.2, §22, §23) + GHL integration health.
Views: leads by pool, unclaimed Hot, SLA breaches, agent availability, demos/contacts today, MRR, projected commission
       liability, refund/dispute exposure, House revenue, integration failures, scraper jobs, compliance alerts.
Add: GHL integration-health tile (last event per client, failed webhooks, unmatched location ids) + funding reconciliation widget.
Notifications: in-app first (new Hot lead, SLA risk, callback due, commission events, payout awaiting approval); email/Slack later.
Accept: command center loads real counts; integration-health tile shows failures; notifications fire on the listed events.
```

## §15 — System settings, feature flags, seed, tests  (OUTLINE)
```txt
Goal: make business rules configurable (scope §25) + seed + test harness + deploy runbook.
Config: claim capacity/SLAs, business hours, scoring weights, commission plans/holds, service SLAs, notification prefs,
        role permissions, integration keys, feature flags, retention/document policies.
Seed: roles/permissions, the v1 commission plan + wholesale schedule, packages, a demo dataset.
Tests: Vitest (unit: commission math, claim transaction, protection timers) + Playwright (e2e: signup→activate→login,
       claim race, booking, funding→ledger). Map to scope §28 acceptance tests.
Deploy: Vercel + Neon + Cloudflare (proxy) runbook; migration + rollback; Sentry for errors.
Accept: settings change behavior without code; seed runs; test suite green on the critical workflows.
```
