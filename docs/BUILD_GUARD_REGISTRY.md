# Mercury Call Desk — Build Guard Registry

## Single source of truth

`config/build-guard-registry.json` is the single source of truth for the ordered Lead-flow build guards and the pass lines shown by deployment verification.

## Why it exists

Before PR #131, the repository maintained the same guard metadata in three places:

- a long `&&` command chain in `package.json`;
- a copied pass-line array in `src/lib/lead-deployment-verification.ts`;
- another copied pass-line array in `scripts/check-deployment-verification-guard.ts`.

That duplication made safe guard or documentation refactors vulnerable to stale metadata. The registry gives each guard one reviewed ID, script path, pass line, execution flag, and deployment-visibility flag.

## Current inventory

The current registry contains:

- 46 deployment-visible pass lines;
- 45 scripts executed by the Lead-flow runner;
- one build-prelude guard, `check-lead-import-response-contract.ts`, which remains executed earlier by the top-level build and is included in deployment verification.

The final Lead-flow guard is the registry's own self-check. The authenticated E2E foundation source guard runs immediately before the Build Guard control-plane and registry checks.

The manifest declares `expectedDeploymentVisibleCount` and `expectedLeadFlowCount`. Validation compares those declarations with the actual filtered entries, so adding or removing a guard requires one reviewed manifest update rather than synchronized count literals across executable scripts.

## Sequential runner

`npm run check:lead-flow-alignment` runs `scripts/run-build-guards.ts`.

The runner:

1. loads the ordered `runInLeadFlow` entries;
2. starts each local TypeScript script with the current Node executable and the `tsx` loader;
3. captures and replays stdout/stderr;
4. fails immediately on spawn error, signal, or non-zero exit;
5. also fails when a script exits zero without emitting its registered pass line.

The runner does not use a shell, `eval`, dynamic remote commands, or secret-specific logic.

## Fail-closed registry validation

`npm run check:build-guard-registry` protects:

- dated PR-version and ISO review metadata;
- manifest-declared deployment-visible and Lead-flow counts;
- exact agreement between declared counts and filtered guard entries;
- unique IDs, script paths, and pass lines;
- local `scripts/check-*.ts` path constraints;
- existence of every registered script;
- presence of each registered pass line in its script source;
- build-prelude and self-check ordering;
- non-shell runner behavior;
- package-script wiring;
- deployment-verification version and pass-line derivation from the manifest;
- documentation and index wiring.

## Compatibility evidence

Several established feature guards verify their own pass-line presence by reading the deployment-verification source and guard files. Clearly marked non-executable compatibility evidence blocks preserve those mature assertions. The registry self-check constructs the expected block from the manifest and requires an exact one-to-one match in both files, so neither block can silently drift or omit a registered line.

Established guards also verify that their script filename remains discoverable from `package.json`. The non-executable `buildGuardCompatibilityScripts` index preserves that contract. The registry self-check derives the expected ordered string from the manifest and requires an exact match.

Neither compatibility representation controls execution or runtime output. The JSON registry remains the only source used by the runner and deployment-verification data model.

## Protected control plane

The Admin-only Build Guard Registry control plane is available at `/admin/build-guards` with JSON at `/api/admin/build-guards`. Both surfaces derive static metadata from the checked-in manifest, expose role-only viewer metadata, and do not execute guards, read source contents, query databases, inspect secrets, access customer data, invoke application endpoints, or perform mutations.

## Authenticated E2E safety guard

`scripts/check-authenticated-e2e-foundation.ts` protects the disposable browser harness before it can run in CI. It requires localhost-only application and database targets, explicit disposable-database opt-in, disabled feature gates, synthetic test identities, no repository secrets, and no production, preview, Neon, GHL, migration, or money-movement target.

The source guard runs during the ordinary Application Build. The browser workflow itself runs separately with PostgreSQL 17 and Chromium.

## Deployment verification

`src/lib/build-guard-registry.ts` derives:

- `BUILD_GUARD_REGISTRY_VERSION` for deployment-verification versioning;
- `LEAD_FLOW_BUILD_GUARDS` for the sequential runner;
- `DEPLOYMENT_GUARD_PASS_LINES` for the protected deployment-verification page and API.

Deployment verification no longer contains a copied version literal or executable pass-line array. Its guard reads the source manifest, verifies the manifest-declared visible count, and protects the required E2E, control-plane, and self-check entries.

## Unchanged behavior

The registry does not replace or weaken any underlying guard. Each existing script still runs as its own Node process and retains its existing assertions, output, and exit behavior.

The top-level build still runs the existing Lead-import prelude checks before the Lead-flow group, then Prisma generation and the Next.js production build.

## Safety boundary

The manifest, runner, and checks operate on repository source and local child processes only. This work does not run production application endpoints, authenticate into production, query or mutate production data, invoke production imports, exports, controlled tests, cron, signup, activation, or webhooks, call GHL, change feature flags or settings, apply migrations, activate Servicing or Commissions, store financial-account data, release payouts, or move money.
