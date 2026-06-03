/**
 * Panic button. Writes a PANIC marker (which the runner checks between tests and aborts on)
 * and best-effort kills any in-flight test processes. Crude on purpose — the goal is "stop
 * everything now", not graceful shutdown.
 *
 * Run:  npm run qa:panic
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PANIC_MARKER = join(__dirname, "..", "PANIC");

function killByPattern(pattern: string): void {
  try {
    execSync(`pkill -f ${JSON.stringify(pattern)}`, { stdio: "ignore" });
    console.log(`  killed processes matching: ${pattern}`);
  } catch {
    /* no matching process — fine */
  }
}

function main(): void {
  writeFileSync(PANIC_MARKER, `panic requested at ${new Date().toISOString()}\n`);
  console.log(`🛑  PANIC: wrote marker ${PANIC_MARKER}`);
  // Order: test engines first, then anything the runner spawned.
  for (const p of ["maestro", "newman", "vitest", "tests/runner/qa.ts"]) killByPattern(p);
  console.log("🛑  PANIC: done. Remove the PANIC marker before running again (qa clears it on start).");
}

// Only fire when invoked directly (e.g. `npm run qa:panic`) — NOT when qa.ts imports
// PANIC_MARKER from this module.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
