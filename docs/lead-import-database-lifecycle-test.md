# Lead-Import Database Lifecycle Test

`npm run test:lead-import-db` is an opt-in integration harness. It exercises the real lead-import service layer against a **separate test database** and removes only records created with its generated `MCD_DBTEST_...` prefix.

It is intentionally not part of normal builds, Vercel previews, or production deployment.

## Safety requirements

The command refuses to start unless all of the following are true:

- `MCD_RUN_DB_INTEGRATION_TESTS=1`
- `MCD_TEST_DATABASE_URL` is present
- `DATABASE_URL` is present for identity comparison
- the normalized `MCD_TEST_DATABASE_URL` target is different from `DATABASE_URL`

Do not use a production database as `MCD_TEST_DATABASE_URL`. Do not place either URL in GitHub, pull requests, workspace logs, or chat transcripts.

## PowerShell example

Set the values only in your current terminal session, using an isolated Neon test branch or equivalent test database:

```powershell
$env:MCD_RUN_DB_INTEGRATION_TESTS = "1"
$env:DATABASE_URL = "<normal non-test database URL used only for comparison>"
$env:MCD_TEST_DATABASE_URL = "<isolated test database URL>"
npm run test:lead-import-db
```

After the terminal closes, those session variables disappear. Clear them manually when finished if desired.

## What it verifies

The harness creates two temporary batches:

1. A clean, in-batch-duplicate, and suppressed-row batch that completes with one imported lead.
2. A batch containing an existing-lead duplicate and a clean row that completes as partially accepted.

It verifies persisted `LeadImportBatch`, `LeadImportRow`, `Lead`, `LeadActivity`, and `AuditLog` outcomes, plus:

- exact batch and row retries;
- changed batch replay rejection;
- changed row replay rejection;
- suppression and in-batch duplicate handling;
- existing-lead duplicate handling;
- pending-review / no-owner lead posture;
- terminal batch protection; and
- cleanup of all prefixed test fixtures.

## Review boundary

Running this test is a controlled test-database action. It is not authorization to run a live export, merge PR #32, change production secrets, or use production data.
