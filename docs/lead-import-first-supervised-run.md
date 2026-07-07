# First Supervised Lead Import Runbook

This runbook is for the first controlled `mcd_lead_ops` export into Mercury Call Desk MiniCRM after the Phase D batch-import API is merged.

## Authority and boundaries

- The MiniCRM is the system of record. `mcd_lead_ops` may only export through the signed API; it must never write directly to Neon/Postgres.
- Use only permitted sources: user-provided files, referrals, web forms, PPC, licensed provider data, owned-account exports, and approved business-site research.
- Do not use Google Maps, LinkedIn, directory scraping, browser automation, or unapproved sources.
- Do not place secrets, raw lead payloads, customer data, or HMAC values in GitHub issues, PRs, or workspace logs.
- This first run is supervised. It is not a campaign launch and does not authorize contact, texting, calling, or automated enrollment.

## Preconditions

1. PR #32 is merged and the production deployment is confirmed at the merge commit.
2. An authorized user has completed production login/MFA and verified `/admin`, `/portal`, and `/admin/servicing` load normally.
3. `LEAD_IMPORT_KEY_ID` and `LEAD_IMPORT_HMAC_SECRET` are confirmed present in the production Vercel environment. Confirm presence only; never display their values.
4. The local `mcd_lead_ops` configuration has matching credentials supplied outside Git and outside workspace logs.
5. The selected local run has completed staging and operator approval. Record the local run ID and approval reference.
6. Start with a deliberately small permitted batch. Use a data-minimization approach and avoid sensitive personal information.

## Controlled export sequence

1. In `mcd_lead_ops`, review the staged run and confirm every row is from an allowed source.
2. Record the operator approval reference before exporting.
3. Export the approved run:

```bash
mcd-leads export --run <local-run-id>
```

4. Record only these non-sensitive results in the daily log:
   - local run ID;
   - MiniCRM batch ID;
   - request/result status for create, upload, preview, submit, and status;
   - final batch status;
   - aggregate row counts;
   - whether any rows were suppressed, duplicate, review-required, rejected, or import-error;
   - production deployment commit; and
   - operator approval reference.

5. Do not record row payloads, HMAC headers, secrets, email addresses, phone numbers, or full lead names in the log.

## Expected batch lifecycle

```txt
DRAFT
  -> ROWS_RECEIVED
  -> PREVIEWED or REVIEW_REQUIRED
  -> APPROVED_FOR_SUBMISSION
  -> SUBMITTED
  -> COMPLETED, PARTIALLY_ACCEPTED, or RECONCILIATION_REQUIRED
```

Clean rows are promoted from `VALID` to `APPROVED` when the recorded batch approval is submitted. Only approved rows may create Leads.

## Stop conditions

Stop the run and do not retry blindly when any of these occur:

- `REVIEW_REQUIRED`: inspect duplicate/review outcomes before any next action.
- `RECONCILIATION_REQUIRED`: inspect import errors and verify no unexpected Lead records were created.
- Unexpected `401`: confirm key ID alignment and signature configuration without exposing values.
- Unexpected `409`: inspect batch state and idempotency/replay information; do not create a new run merely to bypass it.
- Unexpected `5xx`: preserve the batch ID, timestamp, endpoint, and aggregate response status; inspect Vercel logs and database audit records before retrying.

## Post-run verification

An authorized admin verifies:

1. Batch status and aggregate counts through the signed status endpoint.
2. Newly created Lead records match the reported `insertedCount`.
3. Corresponding `LeadActivity` and `AuditLog` records exist for each created Lead.
4. Suppressed rows did not create Leads.
5. Duplicate outcomes did not increase `insertedCount`.
6. Imported Leads remain in the safe pending-review lifecycle with no campaign auto-send or automatic agent assignment.

## Daily-log template

```txt
Date/time:
Production deployment commit:
Local run ID:
MiniCRM batch ID:
Approval reference:
Source category:
Final batch status:
Counts: total / valid / imported / duplicate / suppressed / rejected / review-required / reconciliation-required
Lead and AuditLog verification: pass/fail and aggregate evidence only
Unexpected outcomes and resolution:
Next permitted action:
```

## Completion criteria

The first supervised import is complete only when the final batch status, aggregate counts, Lead records, and AuditLog evidence agree. Any mismatch is a reconciliation event, not a reason to launch campaigns or import more data.
