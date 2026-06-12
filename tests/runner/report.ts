/**
 * Run-scoped output: one timestamped + nonced directory per invocation, a run-params.json
 * snapshot written at the start, per-test-id artifact subdirs, and a summary.json at the end.
 *
 *   tests/output/run-<UTC>-<nonce>/
 *     run-params.json
 *     summary.json
 *     e2e/<test-id>/...        (Maestro --debug-output)
 *     headless/<test-id>/...   (request/response logs, newman json)
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_ROOT = join(__dirname, "..", "output");

export type TestStatus = "pass" | "fail" | "skipped" | "error";

export interface TestResult {
  id: string;
  tool: string;
  layer: string;
  role: string | null;
  tags: string[];
  status: TestStatus;
  durationMs: number;
  /** A failure on an `unverified` test is an expected finding, not a suite failure. */
  expectedFinding: boolean;
  /** A failure on a `bug-filed`/`bug-deferred` test is a KNOWN bug — tracked, not a new failure. */
  knownBug: boolean;
  /** Human-readable purpose (from `qa-reason`), role-interpolated; shown in the report. */
  reason?: string;
  artifactsDir: string;
  message?: string;
}

function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z").replace("T", "t");
}

function gitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

export interface RunParams {
  startedAt: string;
  env: string;
  apiBaseUrl: string;
  dbClassification: string;
  platform: string;
  tags: string[];
  areas: string[];
  roles: string[];
  layers: string[];
  gitSha: string;
  selectedTestIds: string[];
}

/** Live-status entry for a job currently executing (mirrored into current-run.json). */
export interface ActiveJob {
  id: string;
  role: string | null;
  tool: string;
  layer: string;
  tags: string[];
  startedAt: string;
}

export class Run {
  readonly dir: string;
  readonly id: string;
  readonly startedAt: Date = new Date();
  private results: TestResult[] = [];
  private hbState = "starting";
  private hbTotalJobs: number | null = null;
  private active = new Map<string, ActiveJob>();

  constructor() {
    if (!existsSync(OUTPUT_ROOT)) mkdirSync(OUTPUT_ROOT, { recursive: true });
    const nonce = randomBytes(3).toString("hex");
    this.id = `run-${utcStamp(new Date())}-${nonce}`;
    this.dir = join(OUTPUT_ROOT, this.id);
    mkdirSync(this.dir, { recursive: true });
    this.beat("starting");
  }

  /**
   * Heartbeat for outside observers (scripts/testctl.py status): a single well-known
   * file describing the live run. Best-effort only — status reporting must never
   * fail a test run.
   */
  beat(state?: string): void {
    if (state) this.hbState = state;
    try {
      writeFileSync(
        join(OUTPUT_ROOT, "current-run.json"),
        JSON.stringify(
          {
            pid: process.pid,
            runId: this.id,
            runDir: this.dir,
            startedAt: this.startedAt.toISOString(),
            updatedAt: new Date().toISOString(),
            state: this.hbState,
            totalJobs: this.hbTotalJobs,
            completed: this.results.length,
            active: Array.from(this.active.values()),
          },
          null,
          2,
        ),
      );
    } catch { /* best-effort */ }
  }

  setTotalJobs(n: number): void {
    this.hbTotalJobs = n;
    this.beat();
  }

  jobStarted(job: Omit<ActiveJob, "startedAt">): void {
    const key = `${job.id}__${job.role ?? ""}`;
    this.active.set(key, { ...job, startedAt: new Date().toISOString() });
    this.beat("running");
  }

  jobFinished(id: string, role: string | null): void {
    this.active.delete(`${id}__${role ?? ""}`);
    this.beat();
  }

  writeParams(params: Omit<RunParams, "startedAt" | "gitSha">): void {
    const full: RunParams = { startedAt: new Date().toISOString(), gitSha: gitSha(), ...params };
    writeFileSync(join(this.dir, "run-params.json"), JSON.stringify(full, null, 2));
  }

  /** Create (and return) a per-test-id artifact directory under the run. */
  artifactsDir(layer: string, id: string, role?: string | null): string {
    const leaf = role ? `${id}__${role}` : id;
    const dir = join(this.dir, layer, leaf);
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  record(r: TestResult): void {
    this.results.push(r);
  }

  finalize(extra: { canceled?: boolean; cancelReason?: string; gates?: unknown } = {}): {
    summaryPath: string;
    failed: number;
    findings: number;
    knownBugs: number;
    ran: number;
  } {
    // Precedence for a failing test: known bug (filed/deferred) → expected finding (unverified)
    // → new failure. Only "new failure" affects the suite exit code.
    const knownBugs = this.results.filter((r) => r.status === "fail" && r.knownBug).length;
    const findings = this.results.filter((r) => r.status === "fail" && !r.knownBug && r.expectedFinding).length;
    const failed = this.results.filter((r) => r.status === "fail" && !r.knownBug && !r.expectedFinding).length;
    const passed = this.results.filter((r) => r.status === "pass").length;
    const summary = {
      runId: this.id,
      finishedAt: new Date().toISOString(),
      canceled: extra.canceled ?? false,
      cancelReason: extra.cancelReason,
      totals: { total: this.results.length, passed, failed, knownBugs, findings },
      gates: extra.gates,
      results: this.results,
    };
    const summaryPath = join(this.dir, "summary.json");
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    this.active.clear();
    this.beat(extra.canceled ? "canceled" : "done");
    return { summaryPath, failed, findings, knownBugs, ran: this.results.length };
  }

  printTable(): void {
    if (this.results.length === 0) {
      console.log("  (no tests ran)");
      return;
    }
    const icon = (r: TestResult) =>
      r.status === "pass" ? "✅"
      : r.knownBug ? "🐞"
      : r.expectedFinding ? "🔎"
      : r.status === "fail" ? "❌" : "⚠️ ";
    for (const r of this.results) {
      const role = r.role ? ` [${r.role}]` : "";
      const secs = `${(r.durationMs / 1000).toFixed(4)}s`.padStart(10);
      const note = [r.reason, r.message].filter(Boolean).join("  ");
      console.log(`  ${icon(r)} ${r.id}${role}  ${secs}  ${note}`);
    }
  }
}
