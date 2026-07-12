# Mercury Call Desk — Route Tracing

Route tracing is disabled by default.

The application keeps routine authentication and top-level page/layout progress messages behind the server-only `ROUTE_TRACE_ENABLED` flag. This prevents normal builds and requests from filling Vercel logs with expected progress events while retaining an operator-controlled diagnostic path.

## Enable temporarily

Set the server-only environment value:

```text
ROUTE_TRACE_ENABLED=true
```

Redeploy the intended environment, reproduce the issue, collect the relevant `[route-trace]` events, then remove or reset the value to `false` and redeploy.

Do not enable route tracing as a permanent production default. Do not include credentials, tokens, Lead identities, client identities, or financial data in trace metadata.

## Current trace points

- authentication start and completion;
- active-user lookup completion;
- role evaluation;
- Admin landing-page entry;
- portal layout entry.

Trace metadata is limited to booleans such as whether a user ID exists, whether an active user was found, and whether a role check passed. It does not log the user ID, email, role name, session token, Lead ID, or customer data.

## Unchanged logging

This gate does not suppress:

- errors and warnings;
- Auth.js unexpected-error telemetry;
- Lead-aging retry/failure logs;
- database or integration error logs;
- application AuditLog records.

`npm run check:route-trace-hygiene` protects the opt-in gate and prevents the known entry points from reverting to unconditional `console.info` calls.
