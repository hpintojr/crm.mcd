# Client Servicing Health Rollout Status

**Status:** Application workspace built behind a feature gate; schema validated on isolated Neon branch  
**Last updated:** July 2, 2026  
**Activation state:** `SERVICING_ENABLED=false`

## Scope of this phase

This phase manages client account health and service responsibility. It does **not** calculate commissions, create payout records, or move funds.

The operational model is triggered-response servicing:

- Client requests.
- Support issues.
- Payment problems.
- Renewal events.
- Escalations.
- Documented responses and resolutions.

A healthy, current-paying client account is **not** reassigned merely because there was no routine quarterly check-in or other quiet period.

## Application workspace built

### Admin servicing workspace

`/admin/servicing` is feature-gated and supports:

- Creating a client account after a client is won and launched.
- Recording the current servicing owner and originating agent separately.
- Viewing health status, payment standing, open service cases, and recent triggered service events.
- Opening a service case from a client request, support issue, payment problem, renewal event, escalation, or manual review.
- Recording that an agent will continue servicing assigned clients.
- Documenting a House transfer with a reason.

### Agent servicing workspace

`/portal/servicing` is feature-gated and supports:

- Viewing only the client accounts assigned to the signed-in agent.
- Opening service cases only for assigned accounts.
- Recording support responses.
- Resolving assigned service cases.
- Viewing open service cases and health context.

Server-side ownership checks prevent an agent from operating another agent’s client account.

### Assignment and House rules

- An active servicing owner can be explicitly recorded as continuing to service an account.
- When service responsibility is declined, ended through termination, or moved through a documented manager decision, the account can transfer to House.
- House transfer clears the active servicing owner and clears assignment on open service cases.
- The originating agent reference is retained; this phase does not alter commission eligibility because commission logic is still disabled.
- No automated time-based reassignment exists in this phase.

## Schema safety validation

The service-only schema was created and tested on an isolated Neon branch.

- Migration ID: `c89654c3-b534-4308-b617-13b32f6c4b4a`
- Temporary branch: `mcp-migration-2026-07-02T18-21-31`
- Temporary branch ID: `br-hidden-recipe-ajkyias2`
- Validation passed: 4 service tables, 12 relationships, 11 indexes.
- A disposable account, service case, activity, and assignment lifecycle test passed and was deleted from the temporary branch.

The service-only migration intentionally excludes the existing staged commission, payout, and finance tables.

## Production state

- `SERVICING_ENABLED` remains `false`.
- The Client Servicing Health schema has **not** been applied to Neon production yet.
- The production schema commit requires explicit approval using the prepared migration ID above.
- `LEADS_ENABLED`, `COMMISSIONS_ENABLED`, and `FINANCE_ENABLED` remain independently controlled.

## Required next gates

1. Approve the prepared Client Servicing Health migration for Neon production.
2. Confirm the latest application build is `READY`.
3. Run the [Client Servicing Health Acceptance Test](./CLIENT_SERVICING_HEALTH_ACCEPTANCE_TEST.md).
4. Set `SERVICING_ENABLED=true` only for the controlled acceptance-test window.
5. Keep Commissions and Finance disabled during servicing acceptance.

## Following phase

**Commission Eligibility and Ledger** begins only after Client Servicing Health is stable and reviewed. That phase will use service-assignment records as context, but will separately enforce good-standing, retirement, termination, payment-clearing, hold, finance approval, and payout-provider rules.
