# Mercury Call Desk MiniCRM — Documentation Index

## Start here

1. [Project README](../README.md) — platform overview, guardrails, and controlled next steps.
2. [Workspace](./WORKSPACE.md) — current implementation inventory, feature gates, test plan, and operational page map.
3. [Working Instructions](../CLAUDE.md) — coding and operational constraints for future implementation sessions.

## Rollout and acceptance

- [Lead MVP Rollout Status](./LEAD_MVP_ROLLOUT_STATUS.md)
- [Lead MVP Acceptance Test](./LEAD_MVP_ACCEPTANCE_TEST.md)
- [Production Smoke](./PRODUCTION_SMOKE.md) — automated deployed-SHA, status, login, security-header, and protected-boundary verification.
- [Authenticated E2E](./AUTHENTICATED_E2E.md) — localhost-only browser session, Owner/Agent role-boundary, logout, disposable PostgreSQL, and synthetic-user safety contract.
- [Build Guard Registry](./BUILD_GUARD_REGISTRY.md) — single ordered manifest for Lead-flow guard execution, deployment-verification pass lines, and the protected Admin control plane.
- [Lead Aging Cron](./LEAD_AGING_CRON.md) — secured schedule, bounded database readiness retries, failure contracts, and unchanged aging rules.
- [HTTP Security Headers](./HTTP_SECURITY_HEADERS.md) — global anti-framing, MIME, referrer, browser-permission, and opener policies.
- [Route Tracing](./ROUTE_TRACING.md) — opt-in server diagnostic progress logs and safe metadata boundaries.
- [Route Boundary Registry](./ROUTE_BOUNDARY_REGISTRY.md) — source-derived direct-parser/response/error inventory, zero-finding baseline, fail-closed drift checks, and protected control plane.
- [Shared Route JSON Boundary](./SHARED_ROUTE_JSON_BOUNDARY.md) — centralized no-store/request-ID/noindex/retry response metadata for activation, signup, cron, and public status while preserving exact route contracts.
- [Public JSON Body Boundary](./PUBLIC_JSON_BODY_BOUNDARY.md) — shared declared-size, raw-read, actual UTF-8 size, and JSON-parse ordering for public activation and signup.
- [Public Partner Signup](./PUBLIC_SIGNUP.md) — request limits, durable reservation, idempotent duplicate handling, GHL ordering, and minimal public responses.
- [Account Activation](./ACCOUNT_ACTIVATION.md) — token privacy, bounded requests, authenticator preparation, and atomic single-use completion.
- [GHL Webhook Replay](./GHL_WEBHOOK_REPLAY.md) — unique event ledger, duplicate handling, and atomic failed-event retry claims.
- [GHL Webhook Request Boundary](./GHL_WEBHOOK_REQUEST_BOUNDARY.md) — secret-first authentication, bounded JSON intake, response metadata, and sanitized failures.
- [Portal Write Request Boundary](./PORTAL_WRITE_REQUEST_BOUNDARY.md) — authenticated body ordering, 16 KiB limits, hardened responses, and expected-error handling.
- [Admin Controlled Test Request Boundary](./ADMIN_CONTROLLED_TEST_REQUEST_BOUNDARY.md) — Admin-first parsing, bounded requests, controlled-test error mapping, and unchanged preview/apply semantics.
- [Legacy Admin Lead Import Retirement](./LEGACY_ADMIN_LEAD_IMPORT_RETIREMENT.md) — retired duplicate writer, HTTP 410 contract, and supported guarded preview/commit paths.
- [Admin Lead Import Request Boundary](./ADMIN_LEAD_IMPORT_REQUEST_BOUNDARY.md) — Admin-first authorization, a dedicated 1 MiB JSON profile, shared 500-row validation, and generic failure responses for the supported preview/commit endpoints.
- [Signed Lead Import Response Boundary](./LEAD_IMPORT_RESPONSE_BOUNDARY.md) — HMAC-gated bounded body handling and consistent no-store/noindex/request-ID responses across the lifecycle API.
- [Signed Lead Import Domain Errors](./SIGNED_IMPORT_DOMAIN_ERRORS.md) — centralized typed domain-error mapping that preserves exact messages/statuses and removes route-level raw-error findings.
- [Integration Health Control Plane](./INTEGRATION_HEALTH_CONTROL_PLANE.md) — protected aggregate webhook/error health, configuration readiness, privacy contract, and read-failure behavior.
- [Error Tracking](./ERROR_TRACKING.md) — server-only Sentry boundary: DSN-gated instrumentation, uncaught request capture, integration-error forwarding without payloads.
- [Agent Activation Gates](./AGENT_ACTIVATION_GATES.md) — internal W-9/profile/training verification evidence, derived activation state policy, provisioning boundary, and grandfathering rule.
- [Stripe Connect Readiness](./STRIPE_CONNECT_READINESS.md) — staged optional destination policy, privacy boundary, acceptance sequence, and no-execution contract.
- [Protected Admin Read Report Boundary](./ADMIN_READ_REPORT_BOUNDARY.md) — shared request-ID/no-store/noindex responses and role-only viewer metadata for operational JSON reports.
- [Lead Acceptance Report Boundary](./LEAD_ACCEPTANCE_REPORT_BOUNDARY.md) — standardized non-download acceptance JSON responses while preserving report calculations and separate CSV contracts.
- [Protected CSV Download Boundary](./PROTECTED_CSV_DOWNLOAD_BOUNDARY.md) — shared request-ID/no-store/noindex attachment responses while preserving privileged export contracts.
- [Daily Log](./DAILY_LOG.md)

## Current operational reference

- Project Readiness: `/admin/project-readiness`
- Project Readiness API: `/api/admin/project-readiness`
- Build Guard Registry: `/admin/build-guards`
- Build Guard Registry API: `/api/admin/build-guards`
- Route Boundary Registry: `/admin/route-boundaries`
- Route Boundary Registry API: `/api/admin/route-boundaries`
- Integration Health: `/admin/integrations/health`
- Integration Health API: `/api/admin/integrations/health`
- Servicing Acceptance Preflight: `/admin/servicing/acceptance-command-center`
- Servicing Acceptance API: `/api/admin/servicing/acceptance-readiness`
- Lead deployment verification API: `/api/admin/leads/deployment-verification`
- Controlled test data report API: `/api/admin/leads/controlled-test-data`
- Lead acceptance findings: `/api/admin/leads/acceptance-findings`
- Lead acceptance gaps: `/api/admin/leads/acceptance-gaps`
- Lead acceptance gates: `/api/admin/leads/acceptance-gates`
- Lead acceptance handoff: `/api/admin/leads/acceptance-handoff`
- Lead acceptance matrix: `/api/admin/leads/acceptance-matrix`
- Lead acceptance overview: `/api/admin/leads/acceptance-overview`
- Lead acceptance report: `/api/admin/leads/acceptance-report`
- Lead acceptance deep links: `/api/admin/leads/deep-links`
- Lead aging preview: `/api/admin/leads/aging-preview`
- Lead acceptance CSV: `/api/admin/leads/acceptance-report.csv`
- Lead acceptance history CSV: `/api/admin/leads/acceptance-history.csv`
- Lead Aging Cron: `/api/cron/leads/aging`
- Public Partner Signup: `/signup`
- Account Activation: `/activate`
- Admin Lead Review: `/admin/leads`
- Supported Admin Lead import preview: `/api/admin/leads/import/preview`
- Supported Admin Lead import commit: `/api/admin/leads/import`
- Signed Lead-import batch create: `POST /api/lead-imports`
- Signed Lead-import status: `GET /api/lead-imports/[batchId]`
- Signed Lead-import owner acquisition: `POST /api/lead-imports/[batchId]/owner-acquisition`
- Signed Lead-import row upload: `POST /api/lead-imports/[batchId]/rows`
- Signed Lead-import preview: `POST /api/lead-imports/[batchId]/preview`
- Signed Lead-import submit: `POST /api/lead-imports/[batchId]/submit`
- Retired legacy Lead import: `POST /api/admin/leads` (HTTP 410)
- Lead acceptance evidence: `/admin/leads/testing`
- Warm Reply Triage: `/admin/leads/replies`
- Integration Monitor: `/admin/integrations`
- Controlled GHL Test Events: `/api/admin/integrations/test-events`
- Resolved Integration History: `/admin/integrations/resolved`
- Agent Operations: `/admin/agents`
- Client Onboarding Queue: `/admin/servicing/onboarding`
- Client Servicing: `/admin/servicing`
- Readiness Board: `/admin/readiness`
- Audit History: `/admin/audit`

## Documentation maintenance rule

When a workflow or safety boundary changes, update the README, Workspace, relevant rollout/acceptance file, daily log, and this index in the same documentation pass. Do not mark a workflow live merely because code exists; include its gate state and controlled-test status.
