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
import { readFileSync, existsSync, rmSync, openSync, writeSync, closeSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { discoverAll, selectTests, type Layer, type TestDescriptor } from "./select.js";
import { Run, type TestResult, type TestStatus } from "./report.js";
import {
  gateApiHealth,
  gateProductionGuard,
  gateSimulatorBooted,
  gateMetro,
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
}

function parseArgs(argv: string[]): Args {
  const a: Args = {
    tags: [], areas: [], roles: [], layers: [], platform: "ios", env: "local",
    gate: true, seed: true, includeUnverified: false, list: false,
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
      default: console.warn(`(ignoring unknown arg: ${arg})`);
    }
  }
  return a;
}

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
function appendLog(file: string, label: string, res: ReturnType<typeof spawnSync>): void {
  const fd = openSync(file, "a");
  writeSync(fd, `\n===== ${label} (exit ${res.status}) =====\n`);
  if (res.stdout) writeSync(fd, res.stdout.toString());
  if (res.stderr) writeSync(fd, res.stderr.toString());
  closeSync(fd);
}

function runMaestro(
  t: TestDescriptor, role: string | null, creds: RoleCreds | undefined,
  env: EnvCfg, platform: string, artifactsDir: string,
): TestStatus {
  const args = ["test", t.path,
    "-e", `APP_ID=${env.appId}`,
    "-e", `METRO_HOST=${env.metroHost}`,
    "-e", `METRO_PORT=${env.metroPort}`,
    "--debug-output", artifactsDir];
  if (creds) args.push("-e", `EMAIL=${creds.email}`, "-e", `PASSWORD=${creds.password}`, "-e", `ROLE=${role}`);
  if (platform === "web") args.unshift("--platform", "web");
  const res = spawnSync("maestro", args, { cwd: REPO_ROOT, encoding: "utf8" });
  appendLog(join(artifactsDir, "run.log"), `maestro ${t.id}`, res);
  return res.status === 0 ? "pass" : "fail";
}

function runVitest(t: TestDescriptor, baseUrl: string, artifactsDir: string): TestStatus {
  const res = spawnSync(
    "npx",
    ["vitest", "run", "--config", join(TESTS_ROOT, "headless/vitest.headless.config.ts"),
      "--reporter=json", `--outputFile=${join(artifactsDir, "vitest.json")}`, t.path],
    { cwd: REPO_ROOT, encoding: "utf8", env: { ...process.env, QA_BASE_URL: baseUrl } },
  );
  appendLog(join(artifactsDir, "run.log"), `vitest ${t.id}`, res);
  return res.status === 0 ? "pass" : "fail";
}

function runNewman(t: TestDescriptor, baseUrl: string, artifactsDir: string): TestStatus {
  const res = spawnSync(
    "npx",
    ["newman", "run", t.path, "--env-var", `baseUrl=${baseUrl}`,
      "--reporters", "cli,json", "--reporter-json-export", join(artifactsDir, "newman.json")],
    { cwd: REPO_ROOT, encoding: "utf8" },
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
    gates.push(await gateLoadAverage());
    if (needsApi) gates.push(await gateApiHealth(env.apiBaseUrl));

    let pool;
    try {
      pool = makePool(dbUrl || undefined);
      gates.push(await gateProductionGuard(pool, { destructive: willSeed }));
    } catch (err: any) {
      gates.push({ name: "production-guard", status: "fail", waited: false, message: `test canceled: ${err.message ?? err}` });
    } finally {
      await pool?.end().catch(() => {});
    }

    if (needsE2e) {
      gates.push(await gateSimulatorBooted());
      gates.push(await gateMetro(env.metroHost, env.metroPort));
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
      { cwd: REPO_ROOT, encoding: "utf8", env: seedEnv, stdio: "inherit" });
    if (res.status !== 0) {
      const { summaryPath } = run.finalize({ canceled: true, cancelReason: "seed failed", gates });
      console.error(`🚫  test canceled: seed failed`);
      console.error(`📄  ${summaryPath}`);
      process.exit(2);
    }
    console.log("");
  }

  // ── Phase B: run selected tests ───────────────────────────────────────────
  console.log("── Running ────────────────────────────");
  for (const t of selected) {
    const rolesToRun: (string | null)[] = t.roles.length > 0 ? t.roles : [null];
    for (const role of rolesToRun) {
      if (panicRequested()) {
        console.error("🛑  PANIC marker detected — aborting remaining tests.");
        const { summaryPath } = run.finalize({ canceled: true, cancelReason: "panic", gates });
        console.error(`📄  ${summaryPath}`);
        process.exit(2);
      }
      const artifactsDir = run.artifactsDir(t.layer, t.id, role);
      const started = Date.now();
      let status: TestStatus;
      if (t.tool === "maestro") status = runMaestro(t, role, role ? creds[role] : undefined, env, args.platform, artifactsDir);
      else if (t.tool === "vitest") status = runVitest(t, env.apiBaseUrl, artifactsDir);
      else status = runNewman(t, env.apiBaseUrl, artifactsDir);

      const result: TestResult = {
        id: t.id, tool: t.tool, layer: t.layer, role, tags: t.tags,
        status, durationMs: Date.now() - started,
        expectedFinding: t.tags.includes("unverified"),
        artifactsDir,
        message: status === "pass" ? "" : t.tags.includes("unverified") ? "expected finding (see artifacts)" : "see artifacts",
      };
      run.record(result);
      const icon = status === "pass" ? "✅" : result.expectedFinding ? "🔎" : "❌";
      console.log(`  ${icon} ${t.id}${role ? ` [${role}]` : ""} (${result.durationMs}ms)`);
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const { summaryPath, failed, findings } = run.finalize({ gates });
  console.log("\n── Summary ────────────────────────────");
  run.printTable();
  console.log(`\n  ${failed} failure(s), ${findings} expected finding(s).`);
  console.log(`📄  ${summaryPath}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("qa runner crashed:", err);
  process.exit(3);
});
