# Mercury Call Desk — Daily Log

## 2026-07-03 — Recovery Baseline and V1 Rebuild

### Recovery result

- The confirmed working recovery Preview is `recovery/e59-route-fix` at commit `92c052a99c3d0375ca178abc589ee90d38d033bf`.
- The user confirmed that Preview works.
- The route collision caused by duplicate dynamic segments was removed from the recovery baseline.
- Experimental auth/navigation work on `fix/server-login-recovery` is not a valid recovery path and must not be reused.
- Production `main`, production Vercel deployment, production Neon schema, and production customer data were not changed during this rebuild setup.

### Rebuild foundation created

- New rebuild foundation: `rebuild/v1-foundation`.
- V1 scope and acceptance gates added in `docs/REBUILD_V1_SPEC.md`.
- Preview isolation policy added in `docs/REBUILD_V1_PREVIEW_ENVIRONMENT.md`.
- Neon Preview branch created: `preview-rebuild-v1` (`br-twilight-snow-aj4widc4`).
- User confirmed Vercel Preview database variables are wired to the isolated Neon branch.

### Foundation smoke result

- Rebuild Preview deployment: `dpl_6CnxbPvzJLpFyGNPRU7adYrV46Sn`.
- Owner login and MFA completed successfully.
- Session endpoint returned successfully.
- `/admin` returned `200` after authentication.
- A Buffer deprecation warning was emitted during the auth callback. It did not block the completed owner flow and is not being changed inside the current workspace-shell milestone.
- Agent login and Portal routing remain a separate acceptance check before Milestone 0 is fully closed.

## 2026-07-03 — Milestone 1: Role-Aware Workspace Shell

### Active branch

- Branch: `rebuild/m1-role-shell`
- Parent: `rebuild/v1-foundation`
- Latest workspace commit before handoff documentation: `810a3b99c5b01511f84fb73bc36e5f477661af76`
- Preview: `https://crm-mcd-git-rebuild-m1-role-shell-hamiltons-projects-f65eeb81.vercel.app`

### Implemented

- Added a protected Admin workspace shell.
- Added a role-aware `/admin` overview.
- Moved existing Applicant Review access to `/admin/applicants`.
- Applicant Review navigation is visible only to Owner, Super Admin, and Sales Manager roles.
- Kept the Partner Portal reachable from the Admin workspace.
- Kept server-side authorization for Admin routes.

### Not changed

- Credentials login or MFA behavior.
- Neon database schema.
- Lead, client, servicing, commission, or finance workflows.
- GoHighLevel, email, Stripe, payout, or storage integrations.
- `main`, production Vercel, or production Neon.

### Next acceptance steps

1. Owner loads the Milestone 1 Preview and verifies the Admin workspace, Applicant Review link, and Partner Portal link.
2. Test an Agent account in Preview: successful MFA must route to `/portal`; direct Admin access must be denied.
3. Inspect Milestone 1 runtime logs after testing.
4. Record the result here before creating the next focused branch.
