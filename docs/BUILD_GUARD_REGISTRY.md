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

The PR #131 registry contains:

- 44 deployment-visible pass lines;
- 43 scripts executed by the Lead-flow runner;
- one build-prelude guard, `check-lead-import-response-contract.ts`, which remains executed earlier by the top-level build and is included in deployment verification.

The final Lead-flow guard is the registry's own self-check.

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

- exact version and review metadata;
- exact 44-entry and 43-runner counts;
- unique IDs, script paths, and pass lines;
- local `scripts/check-*.ts` path constraints;
- existence of every registered script;
- presence of each registered pass line in its script source;
- build-prelude and self-check ordering;
- non-shell runner behavior;
- package-script wiring;
- deployment-verification derivation from the manifest;
- documentation and index wiring.

## Deployment verification

`src/lib/build-guard-registry.ts` derives:

- `LEAD_FLOW_BUILD_GUARDS` for the sequential runner;
- `DEPLOYMENT_GUARD_PASS_LINES` for the protected deployment-verification page and API.

Deployment verification no longer contains a copied pass-line array. Its guard reads the source manifest and verifies the expected count and required self-check entries.

## Unchanged behavior

The registry does not replace or weaken any underlying guard. Each existing script still runs as its own Node process and retains its existing assertions, output, and exit behavior.

The top-level build still runs the existing Lead-import prelude checks before the Lead-flow group, then Prisma generation and the Next.js production build.

## Safety boundary

The manifest, runner, and checks operate on repository source and local child processes only. This work does not run application endpoints, authenticate into the application, query or mutate production data, invoke imports, exports, controlled tests, cron, signup, activation, or webhooks, call GHL, change feature flags or settings, apply migrations, activate Servicing or Commissions, store financial-account data, release payouts, or move money.
