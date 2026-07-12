# Mercury Call Desk — Integration Health Control Plane

The protected Integration Health control plane provides aggregate operational health without exposing webhook or customer details.

## Surfaces

- Page: `/admin/integrations/health`
- JSON API: `/api/admin/integrations/health`

Both surfaces require an Admin role and are force-dynamic. The JSON API uses no-store/noindex/request-ID response metadata.

## Read-only aggregate contract

The snapshot reads only:

- `WebhookEvent.type` and `WebhookEvent.status` for events created in the last 24 hours;
- aggregate timestamps from `WebhookEvent.createdAt` and `WebhookEvent.processedAt`;
- unresolved `IntegrationError.source` values for bounded in-memory categorization;
- aggregate IntegrationError counts and timestamps;
- boolean GHL configuration readiness and approved-location count;
- environment, branch, and shortened deployed commit SHA.

The snapshot never selects or returns:

- webhook payloads;
- GHL event IDs;
- location IDs;
- raw error messages;
- reference IDs;
- Lead or Agent records;
- email addresses or phone numbers;
- customer identifiers;
- credentials or secret values.

## Health states

- `READY`: inbound webhook configuration is present and there are no failed webhooks in the last 24 hours or unresolved IntegrationErrors.
- `ATTENTION_REQUIRED`: configuration is present, but failed webhooks or unresolved IntegrationErrors exist.
- `CONFIGURATION_INCOMPLETE`: the webhook secret or approved-location set is missing.
- `READ_FAILED`: the database snapshot could not be read. Only the error class name is returned.

A quiet 24-hour traffic window is reported separately as `QUIET`; quiet traffic alone is not treated as a failure.

## Displayed metrics

- total, processed, failed, received, and unknown-status webhook counts for 24 hours;
- aggregate webhook category counts;
- unresolved IntegrationError total and bounded sampled category counts;
- IntegrationErrors resolved in 24 hours;
- latest received, processed, failed, and unresolved-error timestamps;
- inbound/outbound GHL configuration booleans and approved-location count;
- current environment, branch, and shortened commit SHA.

## Read-failure behavior

The helper catches snapshot read failures and returns HTTP 503 from the protected JSON API. It reports only an error class name and does not expose raw Prisma, SQL, connection, hostname, or credential details.

## Regression check

`npm run check:integration-health-control-plane` protects:

- Admin protection on the page and API;
- force-dynamic and no-store/noindex/request-ID behavior;
- exact aggregate Prisma select clauses;
- absence of sensitive field selection;
- absence of mutation primitives;
- fixed event/error category normalization;
- privacy flags stating that no payloads, IDs, messages, references, or contact data are included;
- navigation from the existing Integration Monitor;
- documentation/build/deployment wiring.

The guard is source-only. It does not query production, resolve an error, replay a webhook, run a controlled event, call GHL, or mutate any record.

## Safety boundary

This control plane is read-only. It cannot resolve IntegrationErrors, replay WebhookEvents, trigger GHL, alter feature flags, change Leads, write AuditLog records, apply migrations, or move money.
