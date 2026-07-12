# Lead claim action boundary

The Lead workspace now renders a direct claim action only when both conditions are true:

1. the Lead satisfies the existing two-way-contact, pool, lifecycle, suppression, and ownership gates; and
2. the signed-in actor has a manager-certified Agent profile and is allowed to use direct claim for that Lead.

For administrators and managers, direct claim remains available only for controlled acceptance-test Leads. Real production Leads continue to require the existing Admin reassignment controls.

Known stale claim failures are redirected back to the Lead workspace with a clear status message. Unexpected failures are rethrown so production telemetry still captures genuine defects.

This change does not alter claim capacity, atomic `updateMany` ownership acquisition, the 45-day release timer, claim events, Lead activity, audit records, or the controlled-test exception.
