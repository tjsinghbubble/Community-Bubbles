/**
 * qa — unified test runner.
 *
 * Default (no args): selection tag `smoke`, all three roles, platform ios.
 * Flags: --tag --area --role --layer --platform --env --no-gate --no-seed --seed
 *        --include-unverified --list
 *
 * Flow: select -> write run-params -> gate (fail/wait) -> seed -> run -> summarize.
 * Exit codes: 0 ok (expected findings allowed) · 1 real failure(s) · 2 canceled by a gate.
 */
import { readFileSync, existsSync, rmSync, openSync, writeSync, closeSync, copyFileSync, statSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync, spawn } from "node:child_process";
import { discoverAll, selectTests, type Layer, type TestDescriptor } from "./select.js";
import { Run, type TestResult, type TestStatus } from "./report.js";
import {
  gateApiHealth,
  gateSeededAccount,
  gateProductionGuard,
  gateSchemaDrift,
  gateSimulatorBooted,
  gateMetro,
  gateDriverWarmup,
  gateLoadAverage,
  type GateResult,
} from "./gating.js";
import { makePool } from "../fixtures/journal.js";
import { PANIC_MARKER } from "./panic.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TESTS_ROOT = join(__dirname, "..");
const REPO_ROOT = join(TESTS_ROOT, "..");
const ALL_ROLES = ["role-user", "role-bubble-admin", "role-site-admin"];

// ── arg parsing ──────────────────────────────────────────────────────────────
interface Args {
  tags: string[];
  areas: string[];
  roles: string[];
  layers: Layer[];
  platform: string;
  env: string;
  gate: boolean;
  seed: boolean;
  includeUnverified: boolean;
  list: boolean;
  verbose: boolean;
  help: boolean;
  jobs: number;
}

function parseArgs(argv: string[]): Args {
  const a: Args = {
    tags: [], areas: [], roles: [], layers: [], platform: "ios", env: "local",
    gate: true, seed: true, includeUnverified: false, list: false, verbose: false, help: false,
    jobs: 5,
  };
  const multi = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--tag": a.tags.push(...multi(argv[++i])); break;
      case "--area": a.areas.push(...multi(argv[++i])); break;
      case "--role": a.roles.push(...multi(argv[++i])); break;
      case "--layer": a.layers.push(...(multi(argv[++i]) as Layer[])); break;
      case "--platform": a.platform = argv[++i]; break;
      case "--env": a.env = argv[++i]; break;
      case "--no-gate": a.gate = false; break;
      case "--no-seed": a.seed = false; break;
      case "--seed": a.seed = true; break;
      case "--include-unverified": a.includeUnverified = true; break;
      case "--list": a.list = true; break;
      case "--verbose": case "-v": a.verbose = true; break;
      case "--jobs": { const n = parseInt(argv[++i], 10); if (n >= 1) a.jobs = n; break; }
      case "--help": case "-h": a.help = true; break;
      default: console.warn(`(ignoring unknown arg: ${arg})`);
    }
  }
  return a;
}

const USAGE = `qa — unified test runner (Maestro e2e + headless TS/newman)

Usage:
  npm run qa -- [options]
  npm run qa:list                 alias for: npm run qa -- --list

Selection:
  --tag <a,b>           require ALL listed tags (default: smoke)
  --area <a,b>          select by area tag (auth, security, …); relaxes the smoke
                        filter and includes unverified tests
  --role <r,b>          restrict roles (role-user, role-bubble-admin, role-site-admin)
  --layer <e2e|headless>   run only the named layer(s) (default: both)
  --platform <ios|web>  e2e platform (default: ios)
  --include-unverified  include tests tagged 'unverified'

Run control:
  --env <name>          environment from config/environments.json (default: local)
  --no-gate             skip pre-flight gates (load, API, DB, simulator, driver warmup)
  --no-seed             do not (re)seed the test DB
  --seed                force seeding (default on)
  --list                print the selected tests and exit
  --jobs <N>            headless tests per parallel batch (default 5; e2e always serial)
  -v, --verbose         stream seed + Maestro substep output live (default: quiet, captured)
  -h, --help            show this help

Exit codes: 0 ok (expected findings allowed) · 1 real failure(s) · 2 canceled by a gate · 3 crash
`;

/** Durations are reported in seconds to 4 decimals (per request) rather than raw ms. */
const fmtSecs = (ms: number) => `${(ms / 1000).toFixed(4)}s`;

// ── config ───────────────────────────────────────────────────────────────────
function loadJson(rel: string): any {
  return JSON.parse(readFileSync(join(TESTS_ROOT, rel), "utf8"));
}

interface EnvCfg {
  apiBaseUrl: string; metroHost: string; metroPort: number;
  dbUrlEnv: string; dbUrlFallback: string; dbClass: string; appId: string;
}

function resolveEnv(name: string): EnvCfg {
  const cfg = loadJson("config/environments.json");
  const e = cfg.environments[name];
  if (!e) throw new Error(`unknown env '${name}'. Known: ${Object.keys(cfg.environments).join(", ")}`);
  return e;
}

function resolveDbUrl(e: EnvCfg): string {
  return process.env[e.dbUrlEnv] || e.dbUrlFallback || process.env.DATABASE_URL || "";
}

interface RoleCreds { email: string; password: string }
function loadRoleCreds(): Record<string, RoleCreds> {
  const cfg = loadJson("config/roles.json");
  const out: Record<string, RoleCreds> = {};
  for (const [k, v] of Object.entries<any>(cfg.roles)) out[k] = { email: v.email, password: v.password };
  return out;
}

// ── execution ────────────────────────────────────────────────────────────────
interface ProcResult { status: number | null; stdout?: string | Buffer | null; stderr?: string | Buffer | null; }

function appendLog(file: string, label: string, res: ProcResult): void {
  const fd = openSync(file, "a");
  writeSync(fd, `\n===== ${label} (exit ${res.status}) =====\n`);
  if (res.stdout) writeSync(fd, res.stdout.toString());
  if (res.stderr) writeSync(fd, res.stderr.toString());
  closeSync(fd);
}

/** Promise wrapper around child_process.spawn so headless tests can run concurrently (spawnSync
 *  would block the event loop and serialize them). Resolves — never rejects — with the captured
 *  exit code and output, mirroring the spawnSync shape appendLog expects. */
function spawnAsync(cmd: string, argv: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv }): Promise<ProcResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, argv, { cwd: opts.cwd, env: opts.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => resolve({ status: 1, stdout, stderr: stderr + String(err) }));
    child.on("close", (code) => resolve({ status: code, stdout, stderr }));
  });
}

/**
 * Copy the (newest) deeply-nested maestro.log up to <artifactsDir>/maestro.log. Maestro buries it
 * under .maestro/tests/<timestamp>/, which is where evalScript console.log output and the detailed
 * trace land; surfacing a copy at the artifact root makes it findable without spelunking.
 */
function surfaceMaestroLog(artifactsDir: string): void {
  try {
    const found: { path: string; mtime: number }[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        const st = statSync(full);
        if (st.isDirectory()) walk(full);
        else if (name === "maestro.log") found.push({ path: full, mtime: st.mtimeMs });
      }
    };
    walk(artifactsDir);
    if (found.length === 0) return;
    found.sort((a, b) => b.mtime - a.mtime);
    copyFileSync(found[0].path, join(artifactsDir, "maestro.log"));
  } catch { /* best-effort: surfacing the log must never fail a run */ }
}

function runMaestro(
  t: TestDescriptor, role: string | null, creds: RoleCreds | undefined,
  env: EnvCfg, platform: string, artifactsDir: string, verbose: boolean,
): TestStatus {
  // takeScreenshot in the flows writes to ${SHOT_PREFIX}<name>.png. Point it inside this test's
  // run-scoped artifact dir and prefix the filename with <id>__<role> so the shared common/ steps
  // produce uniquely-named shots instead of dumping <name>.png into the repo root.
  const shotLeaf = role ? `${t.id}__${role}` : t.id;
  const args = ["test", t.path,
    "-e", `APP_ID=${env.appId}`,
    "-e", `METRO_HOST=${env.metroHost}`,
    "-e", `METRO_PORT=${env.metroPort}`,
    "-e", `SHOT_PREFIX=${join(artifactsDir, shotLeaf + "-")}`,
    "--debug-output", artifactsDir];
  if (creds) args.push("-e", `EMAIL=${creds.email}`, "-e", `PASSWORD=${creds.password}`, "-e", `ROLE=${role}`);
  if (platform === "web") args.unshift("--platform", "web");
  // Default: capture substep output to run.log. --verbose: stream it live (run.log then only has
  // the header — the full trace still lands in the surfaced maestro.log via --debug-output).
  const res = spawnSync("maestro", args, { cwd: REPO_ROOT, encoding: "utf8", stdio: verbose ? "inherit" : "pipe" });
  appendLog(join(artifactsDir, "run.log"), `maestro ${t.id}`, res);
  surfaceMaestroLog(artifactsDir);
  return res.status === 0 ? "pass" : "fail";
}

async function runVitest(t: TestDescriptor, baseUrl: string, artifactsDir: string): Promise<TestStatus> {
  const res = await spawnAsync(
    "npx",
    ["vitest", "run", "--config", join(TESTS_ROOT, "headless/vitest.headless.config.ts"),
      "--reporter=json", `--outputFile=${join(artifactsDir, "vitest.json")}`, t.path],
    { cwd: REPO_ROOT, env: { ...process.env, QA_BASE_URL: baseUrl } },
  );
  appendLog(join(artifactsDir, "run.log"), `vitest ${t.id}`, res);
  return res.status === 0 ? "pass" : "fail";
}

async function runNewman(t: TestDescriptor, baseUrl: string, artifactsDir: string): Promise<TestStatus> {
  const res = await spawnAsync(
    "npx",
    ["newman", "run", t.path, "--env-var", `baseUrl=${baseUrl}`,
      "--reporters", "cli,json", "--reporter-json-export", join(artifactsDir, "newman.json")],
    { cwd: REPO_ROOT },
  );
  appendLog(join(artifactsDir, "run.log"), `newman ${t.id}`, res);
  return res.status === 0 ? "pass" : "fail";
}

function panicRequested(): boolean {
  return existsSync(PANIC_MARKER);
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(USAGE); return; }
  if (existsSync(PANIC_MARKER)) rmSync(PANIC_MARKER); // clear stale marker on start

  const env = resolveEnv(args.env);
  const dbUrl = resolveDbUrl(env);
  const creds = loadRoleCreds();

  // Resolve selection: --area relaxes the default smoke filter and includes unverified.
  const tags = args.tags.length > 0 ? args.tags : args.areas.length > 0 ? [] : ["smoke"];
  const includeUnverified = args.includeUnverified || args.areas.length > 0;
  const layers: Layer[] = args.layers.length > 0 ? args.layers : ["e2e", "headless"];
  const roleFilter = args.roles.length > 0 ? args.roles : ALL_ROLES;

  const selected = selectTests(discoverAll(), {
    tags, areas: args.areas, layers, roles: roleFilter, includeUnverified,
  });

  if (args.list) {
    console.log(`Selected ${selected.length} test(s):`);
    for (const t of selected) {
      const r = t.roles.length ? ` roles=[${t.roles.join(",")}]` : "";
      console.log(`  ${t.id.padEnd(22)} ${t.tool.padEnd(8)} [${t.tags.join(", ")}]${r}`);
    }
    return;
  }

  const run = new Run();
  console.log(`\n🏃  ${run.id}  (env=${args.env}, layers=${layers.join("+")}, tags=[${tags.join(",")}], areas=[${args.areas.join(",")}])`);
  console.log(`📁  ${run.dir}\n`);

  const willSeed = args.seed;
  const needsE2e = selected.some((t) => t.layer === "e2e");
  const needsApi = selected.length > 0;

  // ── Phase A: gating ──────────────────────────────────────────────────────
  const gates: GateResult[] = [];
  let canceled: string | undefined;
  if (args.gate && selected.length > 0) {
    console.log("── Gating ─────────────────────────────");
    gates.push(await gateLoadAverage({ ceiling: Number(process.env.QA_LOAD_CEILING ?? 75) }));
    if (needsApi) gates.push(await gateApiHealth(env.apiBaseUrl));

    let pool;
    try {
      pool = makePool(dbUrl || undefined);
      gates.push(await gateProductionGuard(pool, { destructive: willSeed }));
      gates.push(await gateSchemaDrift(pool));
    } catch (err: any) {
      gates.push({ name: "production-guard", status: "fail", waited: false, message: `test canceled: ${err.message ?? err}` });
    } finally {
      await pool?.end().catch(() => {});
    }

    if (needsE2e) {
      gates.push(await gateSimulatorBooted());
      gates.push(await gateMetro(env.metroHost, env.metroPort));
      // Warm the XCUITest driver only once the simulator + Metro are confirmed up, so the cold
      // start is absorbed here (load-scaled budget) rather than failing the first real test. On
      // success, tighten the per-test driver timeout — the warm driver is reused by later runs.
      if (args.platform !== "web" && !gates.some((g) => g.status === "fail")) {
        const warm = await gateDriverWarmup({
          appId: env.appId,
          flowPath: join(TESTS_ROOT, "e2e/common/warmup.yaml"),
          logFile: join(run.dir, "warmup.log"),
          metroHost: env.metroHost,
          metroPort: env.metroPort,
        });
        gates.push(warm);
        if (warm.status === "pass") {
          process.env.MAESTRO_DRIVER_STARTUP_TIMEOUT = String(warm.tightTimeoutMs);
        }
      }
    }

    for (const g of gates) {
      const icon = g.status === "pass" ? "✅" : "❌";
      console.log(`  ${icon} ${g.name}: ${g.message}`);
    }
    const failedGate = gates.find((g) => g.status === "fail");
    if (failedGate) canceled = failedGate.message;
    console.log("");
  }

  if (canceled) {
    const { summaryPath } = run.finalize({ canceled: true, cancelReason: canceled, gates });
    console.error(`🚫  ${canceled}`);
    console.error(`📄  ${summaryPath}`);
    process.exit(2);
  }

  // Record run params (after gating so we know the DB classification).
  const dbClass = (gates.find((g) => g.name === "production-guard") as any)?.classification ?? env.dbClass;
  run.writeParams({
    env: args.env, apiBaseUrl: env.apiBaseUrl, dbClassification: dbClass, platform: args.platform,
    tags, areas: args.areas, roles: roleFilter, layers,
    selectedTestIds: selected.map((t) => t.id),
  });

  // ── Seed ──────────────────────────────────────────────────────────────────
  if (willSeed) {
    console.log("── Seeding test DB ────────────────────");
    const seedEnv = { ...process.env, TEST_DATABASE_URL: dbUrl || process.env.TEST_DATABASE_URL || "" };
    const res = spawnSync("npx", ["tsx", "--env-file=.env", join(TESTS_ROOT, "fixtures/seed.ts")],
      { cwd: REPO_ROOT, encoding: "utf8", env: seedEnv, stdio: args.verbose ? "inherit" : "pipe" });
    // The full seed transcript is always kept on disk; the console stays quiet (one summary line)
    // unless --verbose, or the seed fails — then the captured output is surfaced.
    if (!args.verbose) {
      const transcript = `${res.stdout ?? ""}${res.stderr ?? ""}`;
      try { writeFileSync(join(run.dir, "seed.log"), transcript); } catch { /* best-effort */ }
      if (res.status !== 0) process.stderr.write(transcript);
    }
    if (res.status !== 0) {
      const { summaryPath } = run.finalize({ canceled: true, cancelReason: "seed failed", gates });
      console.error(`🚫  test canceled: seed failed`);
      console.error(`📄  ${summaryPath}`);
      process.exit(2);
    }
    if (!args.verbose) {
      const lastLine = (res.stdout ?? "").trim().split("\n").filter(Boolean).pop();
      console.log(`  ${lastLine ?? "seed complete"}`);
    }
    console.log("");
  }

  // ── Phase A.5: API↔DB consistency (must run after seed) ───────────────────
  // Verify the API actually serves the DB we seeded by logging in a should-exist account.
  if (args.gate && needsApi) {
    const g = await gateSeededAccount(env.apiBaseUrl, creds["role-user"]);
    gates.push(g);
    console.log("── Gating (post-seed) ─────────────────");
    console.log(`  ${g.status === "pass" ? "✅" : "❌"} ${g.name}: ${g.message}\n`);
    if (g.status === "fail") {
      const { summaryPath } = run.finalize({ canceled: true, cancelReason: g.message, gates });
      console.error(`🚫  ${g.message}`);
      console.error(`📄  ${summaryPath}`);
      process.exit(2);
    }
  }

  // ── Phase B: run selected tests ───────────────────────────────────────────
  // e2e runs strictly serially (one simulator, shared UI state). Headless tests are independent
  // HTTP and run in parallel batches of --jobs. Each job is one (test, role) pair.
  console.log("── Running ────────────────────────────");
  interface Job { t: TestDescriptor; role: string | null }
  const jobs: Job[] = [];
  for (const t of selected) {
    const rolesToRun: (string | null)[] = t.roles.length > 0 ? t.roles : [null];
    for (const role of rolesToRun) jobs.push({ t, role });
  }

  const runJob = async ({ t, role }: Job): Promise<void> => {
    const artifactsDir = run.artifactsDir(t.layer, t.id, role);
    const started = Date.now();
    let status: TestStatus;
    if (t.tool === "maestro") status = runMaestro(t, role, role ? creds[role] : undefined, env, args.platform, artifactsDir, args.verbose);
    else if (t.tool === "vitest") status = await runVitest(t, env.apiBaseUrl, artifactsDir);
    else status = await runNewman(t, env.apiBaseUrl, artifactsDir);

    const knownBug = t.tags.includes("bug-filed") || t.tags.includes("bug-deferred");
    const expectedFinding = t.tags.includes("unverified");
    // Interpolate ${ROLE}/${role} in the reason label with the role actually under test.
    const reason = t.reason?.replace(/\$\{ROLE\}/g, role ?? "").replace(/\$\{role\}/g, role ?? "").trim();
    const result: TestResult = {
      id: t.id, tool: t.tool, layer: t.layer, role, tags: t.tags,
      status, durationMs: Date.now() - started,
      expectedFinding, knownBug, reason,
      artifactsDir,
      message: status === "pass" ? ""
        : knownBug ? "known bug (see artifacts)"
        : expectedFinding ? "expected finding (see artifacts)"
        : "see artifacts",
    };
    run.record(result);
    const icon = status === "pass" ? "✅" : knownBug ? "🐞" : expectedFinding ? "🔎" : "❌";
    console.log(`  ${icon} ${t.id}${role ? ` [${role}]` : ""} (${fmtSecs(result.durationMs)})${reason ? ` — ${reason}` : ""}`);
  };

  const abortForPanic = (): never => {
    console.error("🛑  PANIC marker detected — aborting remaining tests.");
    const { summaryPath } = run.finalize({ canceled: true, cancelReason: "panic", gates });
    console.error(`📄  ${summaryPath}`);
    process.exit(2);
  };

  // e2e: serial.
  for (const j of jobs.filter((j) => j.t.layer === "e2e")) {
    if (panicRequested()) abortForPanic();
    await runJob(j);
  }
  // headless: parallel, in batches of args.jobs (checked for panic between batches).
  const headlessJobs = jobs.filter((j) => j.t.layer === "headless");
  for (let i = 0; i < headlessJobs.length; i += args.jobs) {
    if (panicRequested()) abortForPanic();
    await Promise.all(headlessJobs.slice(i, i + args.jobs).map(runJob));
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const { summaryPath, failed, findings, knownBugs } = run.finalize({ gates });
  console.log("\n── Summary ────────────────────────────");
  run.printTable();
  console.log(`\n  ${failed} new failure(s), ${knownBugs} known bug(s), ${findings} expected finding(s).`);
  console.log(`📄  ${summaryPath}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("qa runner crashed:", err);
  process.exit(3);
});
