# Rebuild V1 Preview Environment

## Purpose

All Preview testing for `rebuild/v1-foundation` must use the isolated Neon branch and must not write to production databases or live external services.

## Current Preview Database

- Neon branch name: `preview-rebuild-v1`
- Neon branch ID: `br-twilight-snow-aj4widc4`
- Parent branch: `br-flat-cloud-aj9r0d6b`
- Database: `neondb`

## Required Vercel Preview Variables

The Preview environment must point only to the isolated branch:

- `DATABASE_URL`
- `DIRECT_URL`

No connection strings or secrets are stored in this repository.

## External-Service Guardrails

Preview must not use production credentials for:

- GoHighLevel
- SMTP email delivery
- Stripe or payouts
- document storage

Any integration test must use dedicated test credentials and test recipients.

## Foundation Smoke Gate

A build may move past foundation only after a fresh Preview deployment confirms:

1. public landing page loads
2. owner sign-in with MFA works
3. owner can load an Admin route
4. agent sign-in with MFA works
5. agent can load a Portal route
6. runtime logs have no unhandled error for the tested routes
7. Preview writes appear only in the Neon Preview branch
