# Mercury Call Desk — GHL Webhook Replay Handling

Inbound GHL events use `WebhookEvent.ghlEventId` as the unique replay ledger across appointment, document, funding, invoice, opportunity, and inbound-reply processing.

## First delivery

The first delivery creates one `WebhookEvent` with provider `GHL`, status `RECEIVED`, the event type, location, and raw payload. The consumer may continue only when `recordInboundEvent()` returns `firstTime: true`.

## Normal duplicates

If the unique event ID already exists in any state other than `ERROR`, the delivery is treated as a duplicate. The consumer returns its existing duplicate response and does not repeat business processing, attribution, audit creation, provisioning, or other downstream side effects.

## Atomic failed-event retry claim

An event that previously reached `ERROR` may be retried, but only one retry delivery is allowed to reopen it:

1. The duplicate insert reaches the unique constraint.
2. The shared helper runs one conditional `WebhookEvent.updateMany` with both:
   - the exact `ghlEventId`;
   - current status `ERROR`.
3. The winner changes the event to `RECEIVED`, clears `processedAt`, refreshes the event metadata, and receives `count = 1`.
4. Only that winner returns `firstTime: true, retry: true` and may reprocess the event.
5. Concurrent losers receive `count = 0`, return `firstTime: false`, and remain duplicates with no downstream side effect.

This compare-and-set operation replaces the former read-then-update sequence, where two concurrent retries could both observe `ERROR` and both reopen the same event.

## Shared consumers

The atomic ledger contract is used by:

- appointment webhooks;
- document-completion webhooks;
- funding webhooks;
- invoice webhooks;
- opportunity relays;
- inbound email/SMS reply relays.

Each consumer must check `firstTime` before continuing.

## Unchanged behavior

This change does not alter webhook secrets, approved-location checks, payload schemas, event identifiers, first-delivery processing, non-error duplicate responses, business attribution, provisioning gates, audit names, or event completion statuses.

## Regression check

`npm run check:ghl-webhook-replay-claim` protects the conditional `ERROR` claim, requires exactly one shared `updateMany`, forbids the old read-then-update pattern, and verifies that all six consumers use the shared ledger and stop on duplicates.

The guard performs source validation only. It does not send a webhook, call GHL, query production webhook events, or mutate production data.

## Safety boundary

No webhook endpoint was invoked while implementing or validating this hardening. No Lead, Agent, User, Appointment, onboarding document, callback, audit record, integration record, or external workflow was created or changed in production.
