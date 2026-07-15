# Mercury Call Desk MiniCRM — Daily Log

This file is the rolling index for implementation and rollout activity. Detailed entries live in `docs/daily-logs/`.

| Date | Summary | Entry |
|---|---|---|
| 2026-07-15 | Activation gates migration rehearsed and applied to production under owner authorization; PR #142 merged. Server-only structured error tracking (Sentry) merged, disabled until SENTRY_DSN is configured. Service cadence cron built behind SERVICING_ENABLED with staged SERVICE_CADENCE enum migration | [2026-07-15](./daily-logs/2026-07-15.md) |
| 2026-07-14 | Agent activation gates: internal W-9/profile/training verification evidence, derived activation state policy, provisioning gate, and admin recording UI; additive migration staged, not applied | [2026-07-14](./daily-logs/2026-07-14.md) |
| 2026-07-13 | Stripe Connect readiness foundation: optional destination policy, environment contract, and sandbox setup discovery; no payment or payout execution | [2026-07-13](./daily-logs/2026-07-13.md) |
| 2026-07-08 | Lead data correction and Cold Lead activity-first workspace alignment | [2026-07-08](./daily-logs/2026-07-08.md) |
| 2026-07-02 | Lead, GHL relay, agent onboarding, servicing, audit/readiness, and documentation consolidation pass | [2026-07-02](./daily-logs/2026-07-02.md) |

## Logging rule

Record what was built, what was verified, what remains gated, any intentionally paused work, and the immediate next controlled test. Do not write credentials, test PII, webhook secrets, tax information, or payment details into daily logs.
