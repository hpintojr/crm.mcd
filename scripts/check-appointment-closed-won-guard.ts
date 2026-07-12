import { readFileSync } from "node:fs";

function assertContains(path: string, expected: string) {
  const content = readFileSync(path, "utf8");
  if (!content.includes(expected)) {
    throw new Error(`${path} is missing required Closed Won appointment guard: ${expected}`);
  }
}

// Guards against a regression of PR#98: booking-family appointment events (booked/confirmed/
// rescheduled) must not silently reopen a Lead that has already reached Closed Won, the same
// way recovery-family events (cancelled/no-show) and lost opportunities are already protected.
const guards: [string, string][] = [
  ["src/lib/lead-appointment-attribution.ts", 'const preserveClosedWon = (booked || recovery) && lead.lifecycle === "CLOSED_WON";'],
  ["src/lib/lead-appointment-attribution.ts", 'lifecycle: preserveClosedWon ? lead.lifecycle : booked ? "DEMO_BOOKED" : recovery ? "CONTACTED" : lead.lifecycle,'],
  ["src/lib/controlled-ghl-test-events.ts", 'const preservedClosedWon = (booked || recovery || lost) && lead.lifecycle === "CLOSED_WON";'],
  ["src/lib/controlled-ghl-test-events.ts", "booked && !preservedClosedWon"],
];

for (const [path, expected] of guards) {
  assertContains(path, expected);
}

console.log("Appointment Closed Won guard passed.");
