# CRM.MCD Production Smoke Checklist — 2026-07-08

## Purpose

Use this checklist after production deployments and custom-domain changes to verify the deployed MiniCRM build without mutating production data.

## Non-mutating checks

### 1. Deployment status endpoint

Open:

```text
/api/status
```

Expected:

```text
ok = true
service = crm-mcd
environment = production
git.commitSha = expected production commit
```

For PR #34, the expected merge commit is:

```text
487ff615170f2c9530da61e477935d969d814e69
```

### 2. Custom-domain commit check

Check both the Vercel production alias and the public custom domain:

```text
https://crm-mcd-hamiltons-projects-f65eeb81.vercel.app/api/status
https://crm.mercurycalldesk.com/api/status
```

Both must report the same production commit before considering custom-domain promotion complete.

### 3. Protected route boundary checks

Unauthenticated requests should resolve to the secure sign-in boundary, not a missing page or server error:

```text
/portal/workspace
/portal/leads
/admin/leads/testing
```

Expected:

```text
HTTP 200 sign-in boundary, or equivalent auth redirect/sign-in response
No 404
No 500
```

### 4. Secured cron check

Open without Authorization:

```text
/api/cron/leads/aging
```

Expected:

```text
HTTP 401
{"error":"Unauthorized."}
```

Do not run the cron endpoint with `CRON_SECRET` unless a controlled test window has been approved.

### 5. Runtime logs

Check the production deployment for the current commit.

Expected:

```text
No error or fatal runtime logs in the checked window.
```

## Authenticated controlled checks

Run these only with an approved internal test agent/admin account and controlled test records.

### Lead workspace

- `/portal/leads` loads for an eligible agent.
- Unowned `COLD / AVAILABLE` records appear.
- Click-to-call logs call activity before opening the dialer.
- Click-to-call does not claim, reserve, soft-lock, or assign ownership.
- If activity logging fails, the dialer does not open.
- No-answer and voicemail keep the Lead unowned.
- Callback-requested, qualified, and follow-up/interested record two-way contact and unlock claim eligibility.
- Claim sets owner, `claimedAt`, and a 45-day `openPoolReleaseAt`.

### My Workspace

- `/portal/workspace` loads without requiring a `leadId`.
- Assigned records, callbacks, recent activity, and claim-timer responsibility are visible.

### Admin acceptance board

- `/admin/leads/testing` loads for an admin.
- Smoke results are recorded as audit evidence.

### Warm Reply Triage

- Assignment requires recorded two-way contact.
- Assignment creates owner follow-up work.
- Assignment starts the 45-day responsibility timer.

### DNC

- DNC suppresses the Lead.
- Scheduled callbacks are cancelled.
- The record disappears from sales workflows.

## Gated checks

Do not run these without separate owner approval:

- Live GHL appointment workflow activation.
- Live GHL opportunity workflow activation.
- Live inbound reply workflow activation.
- Production data mutation for aging sweep test cases.
- Servicing rollout.
- Commissions rollout.
- Finance rollout.

## Pass criteria

Production smoke is considered complete only when:

```text
1. /api/status on the custom domain reports the expected merge commit.
2. Protected pages resolve to the auth boundary or authenticated UI.
3. /api/cron/leads/aging returns 401 without Authorization.
4. Runtime logs show no error/fatal entries for the checked window.
5. Authenticated business-rule checks pass with controlled test records.
6. /admin/leads/testing contains the acceptance evidence.
```
