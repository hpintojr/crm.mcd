# Lead MVP Acceptance Evidence Worksheet

Use this worksheet during the controlled Lead MVP test. Run against `TEST —` records and designated test agents only.

## Test window

- Date / time:
- Test owner:
- Admin reviewer:
- Certified test agent:
- Non-certified test agent:
- Lead feature gate opened by:
- Gate closed by:

## Import and review

| Check | Evidence to retain | Pass / fail | Notes |
| --- | --- | --- | --- |
| Valid import preview | Screenshot or row result for `TEST — Valid Web Form Business` |  |  |
| Valid import commit | Review-queue record ID and audit event |  |  |
| In-batch duplicate | Preview result for `TEST — Duplicate Business` |  |  |
| Blocked Maps scrape | Preview rejection for `TEST — Blocked Maps Import` |  |  |
| Protected referral | Review result for `TEST — Referral Business` |  |  |
| No direct Open Pool placement | Approval pool selection shows no Open Pool option |  |  |
| Suppression review | Suppression record and audit event |  |  |

## Agent boundaries and daily work

| Check | Evidence to retain | Pass / fail | Notes |
| --- | --- | --- | --- |
| Certified agent claim | Claimed Lead and claim event |  |  |
| Non-certified claim blocked | Error / denied result |  |  |
| Second agent access blocked | Attempted selected Lead is not available |  |  |
| Note and outcome saved | Lead activity and note history |  |  |
| Callback created | Agent Tasks queue shows callback |  |  |
| DNC suppression | Lead removed from agent list, scheduled callback cancelled |  |  |
| Wrong number / out of business | Invalid-contact suppression and audit event |  |  |

## Open Pool and GHL

| Check | Evidence to retain | Pass / fail | Notes |
| --- | --- | --- | --- |
| Documented return only | Return reason, two-way contact, claim event, and audit entry |  |  |
| Referral return blocked | Attempted return denied |  |  |
| Appointment booked / confirmed | Integration Monitor entry and matched Lead remains owned |  |  |
| Appointment rescheduled | Integration Monitor entry and matched Lead stays Demo Booked |  |  |
| Appointment cancelled / no-show | Immediate same-owner callback and Lead returns to Contacted |  |  |

## Owner decision

- [ ] All required controls passed.
- [ ] Any failure has a documented remediation owner and re-test date.
- [ ] Lead feature can proceed to the next controlled rollout decision.
- [ ] Lead feature remains gated pending remediation.

Owner signature / decision:

Date:
