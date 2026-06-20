/**
 * qa — unified test runner.
 *
 * Default (no args): selection tag `smoke`, all three roles, platform ios.
 * Flags: --tag --area --all --role --layer --platform --env --no-gate --no-seed --seed
 *        --include-unverified --list
 *
 * Flow: select -> write run-params -> gate (fail/wait) -> seed -> run -> summarize.
 * Exit codes: 0 ok (expected findings allowed) · 1 real failure(s) · 2 canceled by a gate.
 */
import { readFileSync, existsSync, rmSync, openSync, writeSync, closeSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, dirname, join } from "node:path";
import { spawnSync, spawn } from "node:child_process";
import { discoverAll, selectTests, AREA_TAGS, type Layer, type TestDescriptor } from "./select.js";
import { Run, type TestResult, type TestStatus } from "./report.js";
import {
  gateApiHealth,
  gateSeededAccount,
  gateProductionGuard,
  gateSchemaDrift,
  gateSimulatorBooted,
  gateSimulatorAge,
  gateAndroidEmulatorBooted,
  gateAppInstalled,
  gateBrittleSelectors,
  gateMetro,
  gateDriverWarmup,
  gateLoadAverage,
  type GateResult,
} from "./gating.js";
import { makePool } from "../fixtures/journal.js";
import { PANIC_MARKER } from "./panic.js";
import { flattenMaestroDebugOutput, copyFlowSources, copyTestSource, headlessShotMode, stubHeadlessScreenshots } from "./artifacts.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TESTS_ROOT = join(__dirname, "..");
const REPO_ROOT = join(TESTS_ROOT, "..");
const ALL_ROLES = ["role-user", "role-bubble-admin", "role-site-admin"];

// ── arg parsing ──────────────────────────────────────────────────────────────
interface Args {
  tags: string[];
  areas: string[];
  all: boolean;
  roles: string[];
  layers: Layer[];
  platform: string;
  platformSet: boolean;   // true iff --platform was passed explicitly (vs the ios default)
  sim: string;
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
    tags: [], areas: [], all: false, roles: [], layers: [], platform: "ios", platformSet: false, sim: "", env: "local",
    gate: true, seed: true, includeUnverified: false, list: false, verbose: false, help: false,
    jobs: 5,
  };
  const multi = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--tag": a.tags.push(...multi(argv[++i])); break;
      case "--area": a.areas.push(...multi(argv[++i])); break;
      case "--all": a.all = true; break;
      case "--role": a.roles.push(...multi(argv[++i])); break;
      case "--layer": a.layers.push(...(multi(argv[++i]) as Layer[])); break;
      case "--platform": a.platform = argv[++i]; a.platformSet = true; break;
      case "--sim": case "--simulator": a.sim = argv[++i]; break;
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
                        filter and includes unverified tests; unknown areas are an error
  --all                 run every registered test, all layers (alias: --area all)
  --role <r,b>          restrict roles (role-user, role-bubble-admin, role-site-admin)
  --layer <e2e|headless>   run only the named layer(s) (default: both)
  --platform <ios|android|web>  e2e platform (default: ios). Optional when --sim is
                        given (the platform is inferred from the sim); if both are
                        passed they must agree or the run aborts.
  --sim, --simulator <id>  pin e2e to a specific device by id/alias (UDID, AVD,
                        adb serial, or a manage_devices alias). Implies --platform.
                        Without it, the platform alias ('ios'/'android') is used,
                        which prefers the one running device and refuses if several
                        are up.
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

Exit codes: 0 ok (expected findings allowed) · 1 real failure(s) · 2 canceled by a gate or bad args · 3 crash
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

// Android emulator localhost != the host. `adb reverse` forwards the emulator's
// localhost:<port> to the host's same port, so the iOS-identical localhost config
// (Metro 8081 + API 3000) reaches the host unchanged — the RN-standard approach.
// (Alternative 10.0.2.2 would require a METRO_HOST override AND the app's API_URL
// rebuilt; reverse keeps one config for both platforms.)
function setupAdbReverse(ports: number[], serial?: string): void {
  const home = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
    || join(process.env.HOME || "", "Library/Android/sdk");
  const adbPath = join(home, "platform-tools/adb");
  const adb = existsSync(adbPath) ? adbPath : "adb";
  // Prefer the explicitly resolved target serial so the reverse lands on the SAME
  // emulator the tests run on; only auto-detect (first emulator) when none is given.
  let target = serial;
  if (!target) {
    const dev = spawnSync(adb, ["devices"], { encoding: "utf8" });
    target = (dev.stdout ?? "").split("\n").map((l) => l.trim().split(/\s+/))
      .find((p) => p[1] === "device" && p[0].startsWith("emulator-"))?.[0];
  }
  if (!target) { console.log("  ⚠️  adb reverse skipped: no emulator serial found"); return; }
  for (const port of ports) {
    spawnSync(adb, ["-s", target, "reverse", `tcp:${port}`, `tcp:${port}`], { encoding: "utf8" });
  }
  console.log(`  🔌 adb reverse ${target}: localhost:${ports.join(",")} → host (Metro + API reachable)`);
}

/**
 * Resolve the e2e target device via manage_devices.py so the run pins Maestro to ONE
 * device. Without this, `maestro test` auto-selects among connected devices and — with
 * both an iOS sim and an Android emulator booted — silently ran iOS flows on Android.
 * `simId` is either an explicit --sim value or the platform alias ('ios'/'android').
 * Returns the bare maestro device id (UDID / adb serial) plus a human description.
 */
function resolveE2eDevice(simId: string): { ok: boolean; deviceId: string; name: string; desc: string; message: string } {
  const res = spawnSync("python3", [join(REPO_ROOT, "scripts/manage_devices.py"), "--resolve", simId],
    { encoding: "utf8" });
  const deviceId = (res.stdout ?? "").trim();
  const desc = (res.stderr ?? "").trim();
  // The rich desc carries the stable device name: `[ aliases ] Android: name="Small_Phone_copy_JFK"`.
  // Capture it so the run records the AVD/device it ran on, not just the reused adb serial.
  const name = desc.match(/name="([^"]+)"/)?.[1] ?? "";
  if (res.status === 0 && deviceId) return { ok: true, deviceId, name, desc, message: `${deviceId}  ${desc}` };
  return { ok: false, deviceId: "", name: "", desc, message: desc || `could not resolve device '${simId}'` };
}

/**
 * Reconcile --platform and --sim BEFORE any device work (web has no sim, so skip it).
 *  - --sim alone: infer the platform from the sim's real kind (manage_devices --kind-of,
 *    offline so the sim need not be booted). The default platform 'ios' is NOT treated as
 *    an explicit choice, so `--sim <android-avd>` correctly runs android.
 *  - --platform + --sim: the sim's kind must match the explicit platform, else abort — a
 *    mismatch means one of the two is wrong and silently trusting either hides the bug.
 *  - --platform alone (no --sim): unchanged; resolveE2eDevice falls back to the platform
 *    alias ('ios'/'android'), which prefers the one running device for that platform.
 * Mutates args.platform to the reconciled value. Exits 2 on an unresolvable sim or a
 * mismatch — both are bad-args, the same exit code as other arg errors.
 */
function reconcilePlatformSim(args: Args): void {
  if (!args.sim || args.platform === "web") return;
  const res = spawnSync("python3", [join(REPO_ROOT, "scripts/manage_devices.py"), "--kind-of", args.sim],
    { encoding: "utf8" });
  const kind = (res.stdout ?? "").trim();   // 'ios' | 'android'
  if (res.status !== 0 || (kind !== "ios" && kind !== "android")) {
    console.error(`error: --sim '${args.sim}' could not be resolved to a device: ${(res.stderr ?? "").trim() || "unknown"}`);
    process.exit(2);
  }
  if (args.platformSet && args.platform !== kind) {
    console.error(`error: --platform ${args.platform} conflicts with --sim '${args.sim}', which is an ${kind} device.`);
    console.error(`  drop --platform (it's inferred from --sim), or pass an ${args.platform} sim.`);
    process.exit(2);
  }
  args.platform = kind;
}

function runMaestro(
  t: TestDescriptor, role: string | null, creds: RoleCreds | undefined,
  env: EnvCfg, platform: string, deviceId: string, artifactsDir: string, verbose: boolean,
): TestStatus {
  // takeScreenshot in the flows writes to ${SHOT_PREFIX}<name>.png. Point it inside this test's
  // run-scoped artifact dir and prefix the filename with <id>-<role> so the shared common/ steps
  // produce uniquely-named shots instead of dumping <name>.png into the repo root.
  const shotLeaf = role ? `${t.id}-${role}` : t.id;
  const args = ["test", t.path,
    "-e", `APP_ID=${env.appId}`,
    "-e", `METRO_HOST=${env.metroHost}`,
    "-e", `METRO_PORT=${env.metroPort}`,
    "-e", `SHOT_PREFIX=${join(artifactsDir, shotLeaf + "-")}`,
    "--debug-output", artifactsDir];
  if (creds) args.push("-e", `EMAIL=${creds.email}`, "-e", `PASSWORD=${creds.password}`, "-e", `ROLE=${role}`);
  // ios is maestro's default target; android and web must be selected explicitly,
  // else maestro silently runs against the booted iOS simulator.
  if (platform !== "ios") args.unshift("--platform", platform);
  // Pin the exact device. maestro's auto device-selection picks among ALL connected
  // devices, so with an iOS sim AND an Android emulator booted it ran iOS flows on the
  // emulator. --device (resolved up front) makes the target deterministic.
  if (deviceId) args.unshift("--device", deviceId);
  // Default: capture substep output to high-level-maestro-output.log. --verbose: stream it live
  // (the log then only has the header — the full trace still lands in internal-maestro-log.log
  // via --debug-output).
  copyFlowSources(t.path, artifactsDir, join(TESTS_ROOT, "e2e"));
  // Per-test wall-clock cap: without it, a single hung maestro test (driver wedge, lost
  // signal, stuck device) blocks the whole run indefinitely — a `--all` sweep once sat on
  // one test for 4h+. e2e flows run ~50-140s, so default 6 min is generous headroom;
  // override via QA_MAESTRO_TIMEOUT_MS. SIGKILL so a wedged driver actually dies.
  const timeoutMs = Number(process.env.QA_MAESTRO_TIMEOUT_MS ?? 360_000);
  const res = spawnSync("maestro", args, {
    cwd: REPO_ROOT, encoding: "utf8", stdio: verbose ? "inherit" : "pipe",
    timeout: timeoutMs, killSignal: "SIGKILL",
  });
  const logPath = join(artifactsDir, "high-level-maestro-output.log");
  const timedOut = (res as { error?: NodeJS.ErrnoException }).error?.code === "ETIMEDOUT"
    || res.signal === "SIGKILL";
  if (timedOut) {
    appendLog(logPath, `maestro ${t.id} — TIMED OUT after ${Math.round(timeoutMs / 1000)}s (killed)`, res);
  } else {
    appendLog(logPath, `maestro ${t.id}`, res);
  }
  // Maestro buried its trace/report/screenshots under .maestro/tests/<timestamp>/ with
  // shell-hostile names; lift them into the artifact dir under typeable, function-first names.
  flattenMaestroDebugOutput(artifactsDir, shotLeaf);
  // T8: a headless android emulator (-no-window) produces all-black screenshots; replace
  // those useless PNGs with a tiny warning stub. Gated by QA_HEADLESS_SCREENSHOTS
  // (auto|stub|keep|skip; default auto = stub black shots only on a headless device).
  const shotMode = headlessShotMode(process.env.QA_HEADLESS_SCREENSHOTS);
  stubHeadlessScreenshots(artifactsDir, shotMode, platform === "android");
  // Maestro's captured output ends with a "Debug output" pointer at the .maestro/tests/<ts>
  // dir the flatten just removed — strip that suffix so the pointer lands on the artifact dir.
  try {
    const txt = readFileSync(logPath, "utf8");
    const fixed = txt.replace(/[/\\]\.maestro[/\\]tests[/\\][\w.-]+/g, "");
    if (fixed !== txt) writeFileSync(logPath, fixed);
  } catch { /* best-effort */ }
  return (!timedOut && res.status === 0) ? "pass" : "fail";
}

async function runVitest(t: TestDescriptor, baseUrl: string, artifactsDir: string): Promise<TestStatus> {
  copyTestSource(t.path, artifactsDir);
  const leaf = basename(artifactsDir);
  const res = await spawnAsync(
    "npx",
    ["vitest", "run", "--config", join(TESTS_ROOT, "headless/vitest.headless.config.ts"),
      "--reporter=json", `--outputFile=${join(artifactsDir, `vitest-results--${leaf}.json`)}`, t.path],
    { cwd: REPO_ROOT, env: { ...process.env, QA_BASE_URL: baseUrl } },
  );
  // On a quiet pass, vitest's output is just "JSON report written to <file>" — a pointer to a
  // file that's already in this directory. Only write the log when there's information beyond it.
  const residue = `${res.stdout ?? ""}\n${res.stderr ?? ""}`
    .replace(/JSON report written to [^\n]*/g, "").trim();
  if (res.status !== 0 || residue) appendLog(join(artifactsDir, "high-level-vitest-output.log"), `vitest ${t.id}`, res);
  return res.status === 0 ? "pass" : "fail";
}

async function runNewman(t: TestDescriptor, baseUrl: string, artifactsDir: string): Promise<TestStatus> {
  copyTestSource(t.path, artifactsDir);
  const leaf = basename(artifactsDir);
  const res = await spawnAsync(
    "npx",
    ["newman", "run", t.path, "--env-var", `baseUrl=${baseUrl}`,
      "--reporters", "cli,json", "--reporter-json-export", join(artifactsDir, `detailed-log--${leaf}.json`)],
    { cwd: REPO_ROOT },
  );
  appendLog(join(artifactsDir, "high-level-newman-output.log"), `newman ${t.id}`, res);
  return res.status === 0 ? "pass" : "fail";
}

function panicRequested(): boolean {
  return existsSync(PANIC_MARKER);
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(USAGE); return; }
  // --sim implies its platform; --platform+--sim must agree. Do this before selection/gating
  // so a mismatch aborts immediately (and a bench script can pass --sim alone for any platform).
  reconcilePlatformSim(args);
  if (existsSync(PANIC_MARKER)) rmSync(PANIC_MARKER); // clear stale marker on start

  const env = resolveEnv(args.env);
  const dbUrl = resolveDbUrl(env);
  const creds = loadRoleCreds();

  // Resolve selection: --area / --all relax the default smoke filter and include unverified.
  if (args.areas.includes("all")) {
    args.all = true;
    args.areas = args.areas.filter((a) => a !== "all");
  }
  // Areas are a closed vocabulary — an unknown name would silently select nothing.
  const unknownAreas = args.areas.filter((a) => !AREA_TAGS.has(a));
  if (unknownAreas.length > 0) {
    console.error(`error: unknown area(s): ${unknownAreas.join(", ")}`);
    for (const a of unknownAreas) {
      if (["smoke", "slow", "alpha-high", "alpha-low", "beta", "unverified"].includes(a)) {
        console.error(`  hint: '${a}' is a selection tag — use --tag ${a}`);
      } else if (["e2e", "headless"].includes(a)) {
        console.error(`  hint: '${a}' is a layer — use --layer ${a}`);
      }
    }
    console.error(`valid areas: all, ${Array.from(AREA_TAGS).sort().join(", ")}`);
    process.exit(2);
  }
  const tags = args.tags.length > 0 ? args.tags : args.all || args.areas.length > 0 ? [] : ["smoke"];
  const includeUnverified = args.includeUnverified || args.areas.length > 0 || args.all;
  const layers: Layer[] = args.layers.length > 0 ? args.layers : ["e2e", "headless"];
  const roleFilter = args.roles.length > 0 ? args.roles : ALL_ROLES;

  const allTests = discoverAll();
  const selected = selectTests(allTests, {
    tags, areas: args.areas, layers, roles: roleFilter, includeUnverified,
  });
  // "Tests written" = every (test, role) pair in the repo, role-expanded the same way the job
  // list is, so Run/Written compares like with like.
  const testsWritten = allTests.reduce((n, t) => n + Math.max(t.roles.length, 1), 0);

  if (args.list) {
    // Layer/platform tags are run dimensions, not test semantics — show them in their own group.
    const LAYER_TAGS = new Set(["e2e", "headless", "ios", "android", "web"]);
    console.log(`Selected ${selected.length} test(s):`);
    for (const t of selected) {
      const r = t.roles.length ? ` roles=[${t.roles.join(",")}]` : "";
      const semantic = t.tags.filter((x) => !LAYER_TAGS.has(x));
      const layerish = t.tags.filter((x) => LAYER_TAGS.has(x));
      console.log(`  ${t.id.padEnd(22)} ${t.tool.padEnd(8)} [${semantic.join(", ")}] layers [${layerish.join(", ")}]${r}`);
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

  // Ctrl-C / Ctrl-\ : finalize with an explicit "user" reason so the run is legible
  // as a deliberate cancel (not a crash). Without this the process just dies and only
  // the placeholder summary remains — indistinguishable from a mid-run crash.
  let cancelHandled = false;
  for (const sig of ["SIGINT", "SIGQUIT"] as const) {
    process.on(sig, () => {
      if (cancelHandled) return;
      cancelHandled = true;
      console.error(`\n🚫  ${sig} — canceled by user; finalizing partial summary.`);
      try {
        run.finalize({ canceled: true, cancelReason: "user", gates });
      } catch { /* best-effort; the placeholder summary still stands */ }
      process.exit(130);
    });
  }
  // The resolved e2e device id (UDID / adb serial) that pins every Maestro invocation,
  // plus the stable device name it maps to (recorded so back-to-back runs on a reused serial
  // are still distinguishable in testctl).
  let e2eDeviceId = "";
  let e2eDeviceName = "";
  if (args.gate && selected.length > 0) {
    console.log("── Gating ─────────────────────────────");
    run.beat("gating");

    // MCP Maestro and CLI Maestro fight over the simulator's singleton XCUITest
    // session (each side's session reinstalls/kills the other's driver runner).
    // Before an e2e run, stop any `maestro mcp` server and the drivers it owns.
    // Best-effort: testctl missing or python3 absent must not block the run.
    if (needsE2e && args.platform === "ios") {
      const res = spawnSync("python3", [join(REPO_ROOT, "scripts/testctl.py"), "nuke", "--nuke=mcp", "--json"],
        { encoding: "utf8" });
      try {
        const acts = JSON.parse(res.stdout ?? "{}").actions ?? [];
        if (acts.length > 0) console.log(`  🔪 stopped MCP Maestro (${acts.length} signal(s)) to free the XCUITest driver`);
      } catch { /* best-effort */ }
    }
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
      // Static, offline, fast: block device-fragile ERROR-class brittle selectors (coords,
      // relative, css, traits) before any simulator/Metro work, so a flow lint failure cancels
      // the suite immediately. RISKY text/index selectors are warned, not failed.
      gates.push(await gateBrittleSelectors(REPO_ROOT));
      if (args.platform === "ios") {
        gates.push(await gateSimulatorBooted());
        // Restart over-age sims before Metro/warmup so the cold start lands on a fresh boot.
        gates.push(await gateSimulatorAge());
      } else if (args.platform === "android") {
        gates.push(await gateAndroidEmulatorBooted());
      }
      // Resolve the ONE target device (after the booted gate, so an Android emulator has its
      // adb serial) and pin every Maestro invocation to it. This closes the routing bug where
      // maestro auto-selected a device and ran iOS flows on a booted Android emulator. Web has
      // no device to pin.
      if (args.platform !== "web" && !gates.some((g) => g.status === "fail")) {
        const simId = args.sim || args.platform;
        const dev = resolveE2eDevice(simId);
        gates.push({
          name: "e2e-device", status: dev.ok ? "pass" : "fail", waited: false,
          message: dev.ok ? `🎯 ${dev.message}` : `test canceled: ${dev.message}`,
        });
        if (dev.ok) { e2eDeviceId = dev.deviceId; e2eDeviceName = dev.name; }
      }
      // Standing rule: the app must be on the resolved device — run it if present, install it
      // from the built binary if not, fail if no binary exists.
      if (args.platform !== "web" && !gates.some((g) => g.status === "fail")) {
        gates.push(await gateAppInstalled({
          platform: args.platform, deviceId: e2eDeviceId, appId: env.appId, repoRoot: REPO_ROOT,
        }));
      }
      // Forward emulator localhost → host so the same localhost Metro/API config reaches the
      // host (the emulator's own localhost would otherwise dead-end). Target the resolved serial.
      if (args.platform === "android" && !gates.some((g) => g.status === "fail")) {
        setupAdbReverse([env.metroPort, Number(new URL(env.apiBaseUrl).port || 3000)], e2eDeviceId);
      }
      gates.push(await gateMetro(env.metroHost, env.metroPort));
      // Warm the XCUITest driver only once the simulator + Metro are confirmed up, so the cold
      // start is absorbed here (load-scaled budget) rather than failing the first real test. On
      // success, tighten the per-test driver timeout — the warm driver is reused by later runs.
      if (args.platform === "ios" && !gates.some((g) => g.status === "fail")) {
        const warmupDir = join(run.dir, "warmup");
        const warm = await gateDriverWarmup({
          appId: env.appId,
          flowPath: join(TESTS_ROOT, "e2e/common/warmup.yaml"),
          logFile: join(run.dir, "warmup.log"),
          metroHost: env.metroHost,
          metroPort: env.metroPort,
          deviceId: e2eDeviceId,
          debugOutput: warmupDir,
        });
        flattenMaestroDebugOutput(warmupDir, "warmup");
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
    deviceId: e2eDeviceId, sim: args.sim, deviceName: e2eDeviceName,
    tags, areas: args.areas, roles: roleFilter, layers,
    selectedTestIds: selected.map((t) => t.id),
  });

  // ── Seed ──────────────────────────────────────────────────────────────────
  if (willSeed) {
    console.log("── Seeding test DB ────────────────────");
    run.beat("seeding");
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
  run.setTotalJobs(jobs.length);

  const runJob = async ({ t, role }: Job): Promise<void> => {
    const artifactsDir = run.artifactsDir(t.layer, t.id, role);
    const started = Date.now();
    run.jobStarted({ id: t.id, role, tool: t.tool, layer: t.layer, tags: t.tags });
    let status: TestStatus;
    if (t.tool === "maestro") status = runMaestro(t, role, role ? creds[role] : undefined, env, args.platform, e2eDeviceId, artifactsDir, args.verbose);
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
        : expectedFinding ? "unverified (see artifacts)"
        : "see artifacts",
    };
    run.record(result);
    run.jobFinished(t.id, role);
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
  const { summaryPath, failed, findings, knownBugs, ran } = run.finalize({ gates });
  console.log("\n── Summary ────────────────────────────");
  run.printTable();
  console.log(`\n  ${failed} new failure(s), ${knownBugs} known bug(s), ${findings} unverified.`);
  const hhmmss = (d: Date) => d.toTimeString().slice(0, 8); // local, 24-hour
  const pct = (num: number, den: number) => (den > 0 ? `${((num / den) * 100).toFixed(1)}%` : "n/a");
  const failedAll = failed + knownBugs + findings; // every fail-status test, however classified
  console.log(
    `  Started: ${hhmmss(run.startedAt)}, Ended: ${hhmmss(new Date())}, ` +
    `Tests Run/Written: ${pct(ran, testsWritten)} (${ran}/${testsWritten}), ` +
    `Tests failed: ${pct(failedAll, ran)} (${failedAll}/${ran})`,
  );
  console.log(`📄  ${summaryPath}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("qa runner crashed:", err);
  process.exit(3);
});
