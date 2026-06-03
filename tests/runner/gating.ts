/**
 * Two-phase gating: critical gates that either FAIL (cancel the suite) or WAIT (poll with a
 * clear message), plus the fail-closed production guard backed by meta.testing_journal.
 *
 * Every gate prints what it is doing so a developer sees "test canceled: ..." or
 * "Waiting for iOS simulator to start..." rather than a silent stall.
 */
import os from "node:os";
import { execSync } from "node:child_process";
import type pg from "pg";
import { classify, currentDbName, type DbClass } from "../fixtures/journal.js";

export type GateStatus = "pass" | "fail";

export interface GateResult {
  name: string;
  status: GateStatus;
  message: string;
  waited: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pollUntil(
  check: () => Promise<boolean>,
  opts: { timeoutMs: number; intervalMs: number; waitingMsg: string },
): Promise<{ ok: boolean; waited: boolean }> {
  const deadline = Date.now() + opts.timeoutMs;
  let waited = false;
  // first attempt with no message
  if (await check()) return { ok: true, waited };
  while (Date.now() < deadline) {
    waited = true;
    console.log(`⏳  ${opts.waitingMsg}`);
    await sleep(opts.intervalMs);
    if (await check()) return { ok: true, waited };
  }
  return { ok: false, waited };
}

async function apiHealthy(baseUrl: string): Promise<boolean> {
  for (const path of ["/api/v1/health", "/api/v1/ping"]) {
    try {
      const res = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(4000) });
      // health may return 503 when a dependency is degraded; ping returns 200 "pong".
      if (path.endsWith("/ping") ? res.ok : res.status < 500) return true;
    } catch {
      /* try next path */
    }
  }
  return false;
}

export async function gateApiHealth(
  baseUrl: string,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<GateResult> {
  const { ok, waited } = await pollUntil(() => apiHealthy(baseUrl), {
    timeoutMs: opts.timeoutMs ?? 60_000,
    intervalMs: opts.intervalMs ?? 3_000,
    waitingMsg: `Waiting for API server at ${baseUrl} ...`,
  });
  return ok
    ? { name: "api-health", status: "pass", message: `API healthy at ${baseUrl}`, waited }
    : {
        name: "api-health",
        status: "fail",
        message: `test canceled: failed health check for API server at ${baseUrl}`,
        waited,
      };
}

/**
 * DB reachability + production guard. `destructive` runs (seed/reset) require classification
 * 'test'; non-destructive runs only warn when the classification is not 'test'.
 */
export async function gateProductionGuard(
  pool: pg.Pool,
  opts: { destructive: boolean },
): Promise<GateResult & { classification: DbClass }> {
  let dbName: string;
  let classification: DbClass;
  try {
    dbName = await currentDbName(pool);
    classification = await classify(pool);
  } catch (err: any) {
    return {
      name: "production-guard",
      status: "fail",
      message: `test canceled: cannot reach test database (${err.message ?? err})`,
      waited: false,
      classification: "unknown",
    };
  }

  if (opts.destructive && classification !== "test") {
    return {
      name: "production-guard",
      status: "fail",
      message:
        `test canceled: refusing destructive run — '${dbName}' classifies as ` +
        `'${classification}', not 'test'. (Seed bootstrap occurs via qa:seed on a *_test DB.)`,
      waited: false,
      classification,
    };
  }

  const note =
    classification === "test"
      ? `DB '${dbName}' classified 'test'`
      : `DB '${dbName}' classified '${classification}' (non-destructive run allowed, proceeding)`;
  return { name: "production-guard", status: "pass", message: note, waited: false, classification };
}

export async function gateSimulatorBooted(opts: { timeoutMs?: number } = {}): Promise<GateResult> {
  const booted = () =>
    Promise.resolve(
      (() => {
        try {
          const out = execSync("xcrun simctl list devices booted", { encoding: "utf8" });
          return /\(Booted\)/.test(out);
        } catch {
          return false;
        }
      })(),
    );
  const { ok, waited } = await pollUntil(booted, {
    timeoutMs: opts.timeoutMs ?? 120_000,
    intervalMs: 4_000,
    waitingMsg: "Waiting for iOS simulator to start...",
  });
  return ok
    ? { name: "ios-simulator", status: "pass", message: "iOS simulator booted", waited }
    : { name: "ios-simulator", status: "fail", message: "test canceled: no iOS simulator booted", waited };
}

export async function gateMetro(
  host: string,
  port: number,
  opts: { timeoutMs?: number } = {},
): Promise<GateResult> {
  const up = async () => {
    try {
      const res = await fetch(`http://${host}:${port}/status`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  };
  const { ok, waited } = await pollUntil(up, {
    timeoutMs: opts.timeoutMs ?? 60_000,
    intervalMs: 3_000,
    waitingMsg: `Waiting for Metro bundler at ${host}:${port} ...`,
  });
  return ok
    ? { name: "metro", status: "pass", message: "Metro bundler up", waited }
    : { name: "metro", status: "fail", message: `test canceled: Metro bundler not reachable at ${host}:${port}`, waited };
}

/** Soft gate: back off while the machine is overloaded, then proceed (never cancels). */
export async function gateLoadAverage(opts: { maxPerCpu?: number; timeoutMs?: number } = {}): Promise<GateResult> {
  const cpus = os.cpus().length || 1;
  const ceiling = (opts.maxPerCpu ?? 2.0) * cpus;
  const ok = () => Promise.resolve(os.loadavg()[0] <= ceiling);
  const { waited } = await pollUntil(ok, {
    timeoutMs: opts.timeoutMs ?? 30_000,
    intervalMs: 5_000,
    waitingMsg: `Waiting for load average to fall below ${ceiling.toFixed(1)} (1-min: ${os.loadavg()[0].toFixed(1)}) ...`,
  });
  // Soft: pass regardless of timeout.
  return {
    name: "load-average",
    status: "pass",
    message: `1-min load ${os.loadavg()[0].toFixed(2)} (ceiling ${ceiling.toFixed(1)})`,
    waited,
  };
}
