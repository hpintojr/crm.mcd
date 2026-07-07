# Private lead acquisition route

The local importer records two opaque acquisition identifiers through a separate signed route after the batch exists.

POST /api/lead-imports/{batchId}/owner-acquisition

This is batch-level metadata, not a shared Lead field and not a row payload.

- Actual provider identity, commercial terms, purchase records, and vendor documents remain outside MiniCRM.
- MiniCRM retains only `sourceCode` and `acquisitionReference` for the batch.
- Uses the standard signed import transport.
- Returns only a generic recorded or unchanged result.
- Exact retries are idempotent; changed data is rejected.
- Normal Lead, review, audit, and agent screens do not select or display this record.
- Only the dedicated Owner-only application page can display it.
- The application guard does not replace database least-privilege controls.
- Maps remains a stored outbound link only; the CRM does not fetch or render Maps content.
