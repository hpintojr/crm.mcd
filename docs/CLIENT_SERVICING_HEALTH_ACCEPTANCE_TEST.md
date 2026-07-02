# Client Servicing Health Acceptance Test

**Purpose:** Verify Client Servicing Health before `SERVICING_ENABLED` is enabled for normal operations.

**Rule:** Keep `SERVICING_ENABLED=false` until the production schema, controlled test records, role controls, and service-assignment rules all pass. Use only internal test client data labeled `TEST —`.

## 1. Pre-activation gate

- [ ] The approved Client Servicing Health Neon migration is applied to production.
- [ ] Current Vercel production deployment is `READY`.
- [ ] `SERVICING_ENABLED=false` before the test window starts.
- [ ] `COMMISSIONS_ENABLED=false` and `FINANCE_ENABLED=false`.
- [ ] One admin test user and two active agent test users are available.
- [ ] Each agent test user is linked to an active Agent record.

## 2. Controlled activation

1. Set `SERVICING_ENABLED=true` in Vercel production environment variables.
2. Redeploy or promote the deployment that reads the new environment value.
3. Confirm `/admin/servicing` is available to an admin.
4. Confirm `/portal/servicing` is available to an active agent.
5. Confirm Commission and Finance pages/workflows remain disabled.

**Pass condition:** Only the intended servicing workspace becomes available.

## 3. Healthy account and quiet-period protection

1. Create a `TEST — Healthy Client` account, assign it to Agent A, and set it as current on payments.
2. Do not create a service case or activity for the account.
3. Confirm the account remains assigned to Agent A.
4. Confirm no case, service violation, or reassignment is created merely because the account has no routine activity.

**Pass condition:** A healthy, current-paying quiet account remains with its servicing owner.

## 4. Triggered service-case workflow

For the same test account:

- [ ] Agent A opens a `CLIENT_REQUEST` case.
- [ ] Confirm health becomes `NEEDS_ATTENTION` and the case is assigned to Agent A.
- [ ] Agent A records a support response.
- [ ] Confirm the case moves to in-progress and the response is logged.
- [ ] Agent A resolves the case with a clear resolution note.
- [ ] Confirm the case closes, the resolution is logged, and health returns to `HEALTHY` when no other cases remain and payment standing is current.

**Pass condition:** Service work is created from a real trigger and closes with a documented result.

## 5. Payment-problem workflow

1. Create or use a separate `TEST — Payment Issue Client` account assigned to Agent A.
2. Open a `PAYMENT_PROBLEM` case.
3. Confirm payment standing becomes not current, account status becomes payment-failed, and health becomes payment-failed.
4. Confirm the problem appears in the admin servicing workspace.
5. From `/admin/servicing/payments`, record a confirmed payment resolution note.
6. Confirm current-payment status is restored, health returns to healthy, and the payment-resolution activity is recorded.
7. Confirm no commission ledger, payout batch, or payout action is created.

**Pass condition:** Payment health is handled as a client-service trigger without activating finance or payout logic.

## 6. Escalation workflow

1. Open an `ESCALATION` case for a test account.
2. Confirm health moves to `AT_RISK` and the account is prioritized in the admin health workspace.
3. Record a response and resolve the case.
4. Confirm the final account status reflects current payment standing and remaining open cases.

**Pass condition:** Escalations are visible, owned, and resolved with a documented trail.

## 7. Agent ownership isolation

1. Assign a test account to Agent A.
2. Sign in as Agent B.
3. Confirm Agent B cannot see the account in `/portal/servicing`.
4. Attempt to submit a case, response, or resolution using the account or case ID as Agent B.
5. Confirm the server rejects the action.
6. Confirm Agent A can still view and operate the account normally.

**Pass condition:** Servicing ownership is enforced server-side.

## 8. Continued servicing and House transfer

For an account assigned to Agent A:

- [ ] As an admin, record `Agent continues service` with a note.
- [ ] Confirm the servicing owner remains Agent A and an assignment event/audit record is created.
- [ ] Confirm no commission setting changes as a side effect.
- [ ] As an admin, transfer a separate test account to House with a valid reason and note.
- [ ] Confirm the servicing owner is cleared, account status becomes `HOUSE`, open cases are unassigned, and a transfer event/activity/audit record is created.
- [ ] Confirm a transfer reason is required.

**Pass condition:** Good-standing agents can retain service responsibility, while declined or ended service responsibility transfers to House with documentation.

## 9. Runtime and audit review

- [ ] Inspect Vercel production runtime errors after the tests; no unexpected errors remain.
- [ ] Review AuditLog entries for account creation, case opening, response, resolution, payment resolution, continued servicing, and House transfer.
- [ ] Confirm test records are clearly labeled and retained only as internal testing records or properly offboarded.

## Owner approval

- Test date: ____________________
- Approved by: ____________________
- Initial servicing test accounts: ____________________
- Notes / exceptions: ____________________

## After approval

Keep `SERVICING_ENABLED=true` only for the controlled rollout. Continue monitoring service cases, payment-health events, House transfers, and audit logs before expanding to normal client volume.

Do not enable Commission or Finance features until the Client Servicing Health stabilization review is complete and the owner authorizes the next phase.
