# Mercury Call Desk — Protected CSV Download Response Boundary

Protected CSV exports use the download-specific response helper `authenticatedCsvDownload` in `src/lib/authenticated-json-boundary.ts`.

## Covered downloads

- `/api/admin/leads/acceptance-history.csv`
- `/api/admin/leads/acceptance-report.csv`
- `/admin/leads/acceptance-summary.csv`
- `/api/admin/audit/export`

## Response contract

Every covered export:

- is force-dynamic;
- requires its existing privileged role boundary;
- returns `Content-Type: text/csv; charset=utf-8`;
- retains its existing attachment filename pattern;
- returns `Cache-Control: no-store, max-age=0`;
- returns a bounded caller-supplied or generated `X-Request-Id`;
- returns `X-Robots-Tag: noindex, nofollow, noarchive`;
- does not parse a request body.

The helper only constructs the response. CSV generation, queries, audit evidence, and role checks remain in their routes.

## Export contracts preserved

### Acceptance history

The route retains:

- the 200-record query bound;
- the existing acceptance-history columns, including reviewer role and reviewer User ID;
- runbook deep links;
- `LEAD_PRODUCTION_ACCEPTANCE_HISTORY_EXPORT_CREATED` AuditLog evidence;
- the `mcd-lead-acceptance-history-YYYY-MM-DD.csv` filename.

### Acceptance summary report

The route retains:

- the 1,000-record acceptance AuditLog query bound;
- controlled evidence summary rows;
- acceptance step, evidence, and summary columns;
- `LEAD_PRODUCTION_ACCEPTANCE_EXPORT_CREATED` AuditLog evidence;
- the `mcd-lead-production-acceptance-YYYY-MM-DD.csv` filename.

### Acceptance overview summary

The route retains:

- the existing `getLeadAcceptanceOverview` source;
- flattened `path,type,value` rows;
- the `mcd-lead-acceptance-summary-YYYY-MM-DD.csv` filename;
- read-only behavior.

Viewer metadata is role-only; the internal viewer User ID and email are not embedded in the summary CSV.

### Privileged AuditLog export

The route retains:

- the OWNER, SUPER_ADMIN, COMPLIANCE_MANAGER, and FINANCE_MANAGER role boundary;
- the 10,000-record query bound;
- actor User ID, role, action, entity, reason, IP address, and metadata columns;
- `AUDIT_EXPORT_CREATED` AuditLog evidence;
- the `mcd-audit-YYYY-MM-DD.csv` filename.

These fields are intentionally preserved because this is the privileged audit export, not a general operational report.

## Regression check

`npm run check:protected-csv-download-boundary` protects:

- shared CSV content-type, attachment, no-store, noindex, and request-ID headers;
- role checks and force-dynamic behavior;
- filenames, columns, query bounds, and export AuditLog action types;
- role-only metadata in the acceptance overview CSV;
- absence of route-level body parsing and direct response construction;
- documentation/build/deployment wiring.

The guard is source-only. It does not invoke an export, query production, download customer or audit data, or write export AuditLog evidence.

## Safety boundary

No CSV or AuditLog export endpoint was authenticated or accessed while implementing or validating this work. No acceptance record, Lead, AuditLog, feature flag, GHL workflow, Servicing record, Commission record, payment, or payout was mutated.
