import { spawnSync } from "node:child_process";
import { LEAD_FLOW_BUILD_GUARDS } from "../src/lib/build-guard-registry";

function runGuard(guard: (typeof LEAD_FLOW_BUILD_GUARDS)[number]) {
  console.log(`[build-guard] ${guard.id} -> ${guard.script}`);

  const result = spawnSync(process.execPath, ["--import", "tsx", guard.script], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.error) {
    throw new Error(`Build guard ${guard.id} could not start: ${result.error.message}`);
  }
  if (result.signal) {
    throw new Error(`Build guard ${guard.id} terminated by signal ${result.signal}.`);
  }
  if (result.status !== 0) {
    throw new Error(`Build guard ${guard.id} failed with exit code ${String(result.status)}.`);
  }

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (!output.includes(guard.passLine)) {
    throw new Error(`Build guard ${guard.id} exited successfully without its registered pass line: ${guard.passLine}`);
  }
}

function main() {
  if (LEAD_FLOW_BUILD_GUARDS.length === 0) {
    throw new Error("Build guard registry contains no lead-flow guards.");
  }

  for (const guard of LEAD_FLOW_BUILD_GUARDS) runGuard(guard);

  console.log(`Build guard runner passed ${LEAD_FLOW_BUILD_GUARDS.length} registered guards.`);
}

main();
