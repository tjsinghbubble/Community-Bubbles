/**
 * Two-phase gating: critical gates that either FAIL (cancel the suite) or WAIT (poll with a
 * clear message), plus the fail-closed production guard backed by meta.testing_journal.
 *
 * Every gate prints what it is doing so a developer sees "test canceled: ..." or
 * "Waiting for iOS simulator to start..." rather than a silent stall.
 */
import os from "node:os";
import { join } from "node:path";
import { execFileSync, execSync, spawnSync } from "node:child_process";
import { appendFileSync, existsSync } from "node:fs";
import type pg from "pg";
import { classify, currentDbName, type DbClass } from "../fixtures/journal.js";
import { schemaSignature, readSchemaBaseline, diffSchema } from "../fixtures/signatures.js";

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
 * API↔DB consistency gate: prove the API-under-test is actually serving the database we seeded
 * by authenticating a should-exist seeded account against it. Catches the silent failure mode
 * where the seed writes one DB (e.g. bubble_test) but the running API serves another (bubble_dev),
 * which otherwise surfaces only as a buried 401 deep in a test. Run AFTER seeding, since a fresh
 * test DB has no account until then. The fix it points at — `npm run qa:server` — is the API
 * launcher that pins DATABASE_URL to the *_test DB.
 */
export async function gateSeededAccount(
  baseUrl: string,
  cred: { email: string; password: string } | undefined,
): Promise<GateResult> {
  if (!cred) {
    return { name: "seeded-account", status: "fail", waited: false, message: "test canceled: no role-user credentials in config/roles.json to verify" };
  }
  // A non-2xx HTTP *response* (401/429/etc.) is definitive — classify and return immediately. Only
  // a thrown fetch (network/loopback blip) is retried: api-health already proved the server
  // reachable, so a single "fetch failed" shouldn't cancel the whole run.
  const attempts = 3;
  let lastErr: any;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: cred.email, password: cred.password }),
        signal: AbortSignal.timeout(8000),
      });
    } catch (err: any) {
      lastErr = err;
      if (attempt < attempts) { await sleep(1000); continue; }
      return {
        name: "seeded-account",
        status: "fail",
        waited: attempt > 1,
        message:
          `test canceled: could not reach API at ${baseUrl}/api/auth/login after ${attempts} tries ` +
          `(${err?.message ?? err}). api-health passed, so this is a connectivity blip, not a wrong-DB ` +
          `mismatch — classically localhost resolving to IPv6 (::1) while the dev server binds IPv4. ` +
          `The runner now forces ipv4first; if this persists, set apiBaseUrl to http://127.0.0.1:3000.`,
      };
    }
    let json: any = null;
    try { json = JSON.parse(await res.text()); } catch { /* non-JSON */ }
    if (res.ok && json?.token) {
      return { name: "seeded-account", status: "pass", waited: attempt > 1, message: `API authenticates seeded ${cred.email}` };
    }
    // 429 is rate limiting / lockout, NOT evidence of a DB mismatch. Don't cancel the run for it
    // (this gate's job is to catch wrong-DB, i.e. invalid-credentials); surface it as a warning.
    if (res.status === 429) {
      return {
        name: "seeded-account",
        status: "pass",
        waited: attempt > 1,
        message:
          `could not verify ${cred.email} — login rate-limited (429), not a DB mismatch. The auth ` +
          `limiter is tripped; restart via \`npm run qa:server\` (raises RATE_LIMIT_AUTH_MAX/SEND_MAX) ` +
          `to clear it. Proceeding.`,
      };
    }
    return {
      name: "seeded-account",
      status: "fail",
      waited: attempt > 1,
      message:
        `test canceled: API at ${baseUrl} rejected seeded account ${cred.email} (login -> ${res.status}). ` +
        `The API is most likely connected to a different database than the one just seeded. ` +
        `Start it with \`npm run qa:server\` so it serves the *_test DB.`,
    };
  }
  // Loop always returns above; this satisfies the type checker.
  return { name: "seeded-account", status: "fail", waited: true, message: `test canceled: seeded-account check failed (${lastErr?.message ?? lastErr})` };
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

/**
 * Schema-drift gate: compare the live public schema to the baseline captured at provision time
 * (meta.schema_baseline). Catches the `users.suspended_at`-class problem up front and names the
 * exact column, instead of letting it surface as a buried runtime error. Cheap — no table scan.
 * If no baseline exists, it can't compare and passes with a note.
 */
export async function gateSchemaDrift(pool: pg.Pool): Promise<GateResult> {
  let baseline, current;
  try {
    baseline = await readSchemaBaseline(pool);
    current = await schemaSignature(pool);
  } catch (err: any) {
    return { name: "schema-drift", status: "fail", waited: false, message: `test canceled: schema check failed (${err.message ?? err})` };
  }
  if (!baseline) {
    return { name: "schema-drift", status: "pass", waited: false, message: "no schema baseline recorded (run qa:provision) — skipping" };
  }
  if (baseline.rollup === current.rollup) {
    return { name: "schema-drift", status: "pass", waited: false, message: `schema matches baseline (schema-sig=${current.rollup})` };
  }
  const diffs = diffSchema(current.perTable, baseline.perTable);
  const shown = diffs.slice(0, 6).join("; ");
  const more = diffs.length > 6 ? ` (+${diffs.length - 6} more)` : "";
  return {
    name: "schema-drift",
    status: "fail",
    waited: false,
    message: `test canceled: schema drift (live ${current.rollup} vs baseline ${baseline.rollup}) — ${shown}${more}`,
  };
}

/**
 * Static lint: fail the suite if any Maestro flow uses an ERROR-class brittle selector
 * (coordinate point/swipe, relative above/below/leftOf/rightOf, css, traits) without a
 * `# brittle-ok:` justification — these are device-size-fragile (a 390x844-calibrated point
 * mis-taps on an iPhone 17 and derails the flow). RISKY selectors (text/index used to locate)
 * only warn — their count is surfaced but does not fail. Fast + offline — runs before any
 * device work. See scripts/check_brittle_selectors.py.
 */
export async function gateBrittleSelectors(repoRoot: string): Promise<GateResult> {
  const res = spawnSync("python3", [join(repoRoot, "scripts/check_brittle_selectors.py")],
    { cwd: repoRoot, encoding: "utf8" });
  const out = res.stdout || "";
  const risky = out.match(/(\d+) risky/);
  const riskyNote = risky && risky[1] !== "0" ? ` (${risky[1]} risky text/index warned)` : "";
  if (res.status === 0) {
    return { name: "brittle-selectors", status: "pass", waited: false,
      message: `no un-annotated ERROR-class brittle selectors in flows${riskyNote}` };
  }
  const offenders = out.split("\n").filter((l) => l.includes("✘ ERROR"));
  const shown = offenders.slice(0, 5).map((l) => l.replace(/^✘ ERROR\s*/, "").trim()).join("; ");
  return { name: "brittle-selectors", status: "fail", waited: false,
    message: `test canceled: ${offenders.length} brittle ERROR selector(s) — ${shown}` +
      ` (use a testID/accessibility id, or add '# brittle-ok: <reason>')` };
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

function androidAdb(): string {
  const home = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
    || join(os.homedir(), "Library/Android/sdk");
  const p = join(home, "platform-tools/adb");
  return existsSync(p) ? `"${p}"` : "adb";
}

// Android counterpart to gateSimulatorBooted: a device must be attached in
// `device` state AND past sys.boot_completed (layer-2 readiness — `device` alone
// races the framework). Flavor-aware: a `simulated` run matches an `emulator-*`
// serial (which still has booting to do); a `real` run matches a physical serial
// (a non-`emulator-*` serial in `device` state — already booted, this is just a
// presence/readiness check). An explicit deviceSerial pins the match exactly.
export async function gateAndroidEmulatorBooted(
  opts: { timeoutMs?: number; flavor?: string; deviceSerial?: string } = {},
): Promise<GateResult> {
  const adbBin = androidAdb().replace(/^"|"$/g, "");
  const wantReal = opts.flavor === "real";
  const matchSerial = (serial: string) =>
    opts.deviceSerial ? serial === opts.deviceSerial
      : wantReal ? !serial.startsWith("emulator-") : serial.startsWith("emulator-");
  const booted = () =>
    Promise.resolve(
      (() => {
        try {
          const out = execFileSync(adbBin, ["devices"], { encoding: "utf8" });
          const row = out.split("\n").map((l) => l.trim().split(/\s+/))
            .find((p) => p.length >= 2 && p[1] === "device" && matchSerial(p[0]));
          if (!row) return false;
          const bc = execFileSync(adbBin, ["-s", row[0], "shell", "getprop", "sys.boot_completed"],
            { encoding: "utf8" }).trim();
          return bc === "1";
        } catch {
          return false;
        }
      })(),
    );
  const label = wantReal ? "Android device" : "Android emulator";
  const { ok, waited } = await pollUntil(booted, {
    timeoutMs: opts.timeoutMs ?? 120_000,
    intervalMs: 4_000,
    waitingMsg: `Waiting for ${label} to be ready...`,
  });
  return ok
    ? { name: "android-emulator", status: "pass", message: `${label} booted`, waited }
    : { name: "android-emulator", status: "fail", message: `test canceled: no booted ${label}`, waited };
}

/** Newest sim .app (DerivedData or mobile/ios/build) whose bundle id matches appId. */
function findIosApp(appId: string, repoRoot: string): string | null {
  const globs = [
    `"${os.homedir()}/Library/Developer/Xcode/DerivedData"/*/Build/Products/*-iphonesimulator/*.app`,
    `"${repoRoot}/mobile/ios/build/Build/Products"/*-iphonesimulator/*.app`,
  ];
  const res = spawnSync("bash", ["-lc", `ls -dt ${globs.join(" ")} 2>/dev/null`], { encoding: "utf8" });
  const apps = (res.stdout ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  for (const app of apps) {
    try {
      const id = execSync(`/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "${app}/Info.plist"`,
        { encoding: "utf8" }).trim();
      if (id === appId) return app;
    } catch { /* not a sim app bundle / unreadable plist */ }
  }
  return null;
}

/** Newest debug APK under the gradle output dirs, or null. */
function findAndroidApk(repoRoot: string): string | null {
  const globs = [
    `"${repoRoot}/mobile/android/app/build/outputs/apk/debug"/*.apk`,
    `"${repoRoot}/mobile/android/app/build/outputs/apk"/*/*.apk`,
  ];
  const res = spawnSync("bash", ["-lc", `ls -dt ${globs.join(" ")} 2>/dev/null`], { encoding: "utf8" });
  return (res.stdout ?? "").split("\n").map((s) => s.trim()).filter(Boolean)[0] ?? null;
}

/**
 * App-presence gate (e2e): the app under test must be on the resolved device. Standing rule —
 * run it if it's there, install it if it's not, fail if no binary is available. Closes the gap
 * where a freshly-resolved iOS sim had no com.bubble.mobile and Maestro died at clearAppState.
 */
export async function gateAppInstalled(opts: {
  platform: string; deviceId: string; appId: string; repoRoot: string;
  flavor?: string;   // 'real' | 'simulated' — picks the build/install path
}): Promise<GateResult> {
  const { platform, deviceId, appId, repoRoot, flavor } = opts;
  if (platform === "web") {
    return { name: "app-installed", status: "pass", waited: false, message: "no app to install (web)" };
  }
  if (!deviceId) {
    return { name: "app-installed", status: "fail", waited: false, message: "test canceled: no resolved device to check app install on" };
  }
  // iOS real-device install is out of scope (no DEVELOPMENT_TEAM / signing; baked
  // EXPO_PUBLIC_API_URL). The simulator path below (simctl) cannot target a real phone,
  // so fail with a clear message rather than a confusing simctl error.
  if (platform === "ios" && flavor === "real") {
    return { name: "app-installed", status: "fail", waited: false,
      message: "test canceled: iOS real-device install not supported (signing unresolved); "
        + "listing/abstraction only. Use a simulator, or an Android real device." };
  }
  if (platform === "ios") {
    let installed = false;
    try { execSync(`xcrun simctl get_app_container ${deviceId} ${appId}`, { stdio: "pipe" }); installed = true; }
    catch { installed = false; }
    if (installed) return { name: "app-installed", status: "pass", waited: false, message: `${appId} present on ${deviceId}` };
    const app = findIosApp(appId, repoRoot);
    if (!app) {
      return { name: "app-installed", status: "fail", waited: false,
        message: `test canceled: ${appId} not installed on ${deviceId} and no .app binary found — build it with \`npm run mobile:build:ios-sim\`` };
    }
    try { execSync(`xcrun simctl install ${deviceId} "${app}"`, { stdio: "pipe" }); }
    catch (err: any) {
      return { name: "app-installed", status: "fail", waited: true,
        message: `test canceled: failed to install ${appId} on ${deviceId} (${err?.stderr?.toString().trim() || err?.message || err})` };
    }
    return { name: "app-installed", status: "pass", waited: true, message: `installed ${appId} from ${app.replace(os.homedir(), "~")}` };
  }
  if (platform === "android") {
    const adb = androidAdb();
    let installed = false;
    try {
      const out = execSync(`${adb} -s ${deviceId} shell pm list packages ${appId}`, { encoding: "utf8" });
      installed = out.includes(`package:${appId}`);
    } catch { installed = false; }
    if (installed) return { name: "app-installed", status: "pass", waited: false, message: `${appId} present on ${deviceId}` };
    const apk = findAndroidApk(repoRoot);
    if (!apk) {
      return { name: "app-installed", status: "fail", waited: false,
        message: `test canceled: ${appId} not installed on ${deviceId} and no APK found — build it with \`npm run android\` in mobile/` };
    }
    try { execSync(`${adb} -s ${deviceId} install -r "${apk}"`, { stdio: "pipe" }); }
    catch (err: any) {
      return { name: "app-installed", status: "fail", waited: true,
        message: `test canceled: failed to install APK on ${deviceId} (${err?.stderr?.toString().trim() || err?.message || err})` };
    }
    // AOT-compile the fresh install (seconds): install -r resets the package's compile
    // state, so an overnight `manage_devices --bake` can never cover the app-under-test —
    // this per-install pass is the only place its JIT churn (test-timing noise) can be
    // trimmed. Maestro's driver, if present, gets the same treatment. Best-effort: a
    // failed compile never blocks the run.
    const aoted: string[] = [];
    for (const pkg of [appId, "dev.mobile.maestro", "dev.mobile.maestro.test"]) {
      try {
        execSync(`${adb} -s ${deviceId} shell cmd package compile -m speed-profile ${pkg}`, { stdio: "pipe" });
        aoted.push(pkg);
      } catch { /* not installed or compile unsupported — fine */ }
    }
    const aotNote = aoted.length ? ` + AOT speed-profile (${aoted.join(", ")})` : "";
    return { name: "app-installed", status: "pass", waited: true, message: `installed ${appId} from ${apk}${aotNote}` };
  }
  return { name: "app-installed", status: "pass", waited: false, message: `no app install step for platform '${platform}'` };
}

// Simulators booted longer than ~500,000s have shown instability (crashing sim-side
// processes). Mandatory restart at 95% of that age; warnings start at 80%.
const SIM_INSTABILITY_S = 500_000;
const SIM_RESTART_S = SIM_INSTABILITY_S * 0.95; // 475,000 s
const SIM_WARN_S = SIM_INSTABILITY_S * 0.8; // 400,000 s

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDeadline(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Boot-age gate: warn for sims between 80% and 95% of the instability age; shut down and
 * re-boot any sim past 95% before tests run, so the run never starts on a sim that is about
 * to grow crashing processes mid-suite.
 */
export async function gateSimulatorAge(): Promise<GateResult> {
  let data: any;
  try {
    data = JSON.parse(execSync("xcrun simctl list -j devices booted", { encoding: "utf8" }));
  } catch (err: any) {
    return {
      name: "sim-boot-age", status: "pass", waited: false,
      message: `could not read simulator list (${err?.message ?? err}) — skipping age check`,
    };
  }

  const now = Date.now();
  const sims: { udid: string; name: string; bootedAtMs: number; ageS: number }[] = [];
  for (const devs of Object.values(data.devices ?? {})) {
    for (const d of devs as any[]) {
      if (d.state !== "Booted" || !d.lastBootedAt) continue;
      const bootedAtMs = Date.parse(d.lastBootedAt);
      if (Number.isNaN(bootedAtMs)) continue;
      sims.push({ udid: d.udid, name: d.name, bootedAtMs, ageS: (now - bootedAtMs) / 1000 });
    }
  }

  const over = sims.filter((s) => s.ageS >= SIM_RESTART_S);
  const aging = sims.filter((s) => s.ageS >= SIM_WARN_S && s.ageS < SIM_RESTART_S);

  for (const s of aging) {
    console.log(
      `⚠️   Simulator '${s.name}' has been booted ${(s.ageS / 86400).toFixed(1)} days. Sims this old ` +
        `grow unstable past ${SIM_INSTABILITY_S.toLocaleString()}s — restart it by ` +
        `${fmtDeadline(s.bootedAtMs + SIM_RESTART_S * 1000)}.`,
    );
  }

  if (over.length === 0) {
    const message = aging.length
      ? `aging sim(s): ${aging.map((s) => `'${s.name}' booted ${(s.ageS / 86400).toFixed(1)}d`).join(", ")} — restart soon`
      : sims.length
        ? `all booted sims under ${(SIM_WARN_S / 86400).toFixed(1)}d boot age`
        : "no booted simulator to age-check";
    return { name: "sim-boot-age", status: "pass", message, waited: false };
  }

  const restarted: string[] = [];
  for (const s of over) {
    console.log(
      `🔄  Restarting simulator '${s.name}' (${s.udid}): booted ${(s.ageS / 86400).toFixed(1)} days — past ` +
        `the mandatory-restart age (95% of the ${SIM_INSTABILITY_S.toLocaleString()}s mark where booted ` +
        `sims develop crashing processes).`,
    );
    try {
      execSync(`xcrun simctl shutdown ${s.udid}`, { stdio: "pipe", encoding: "utf8" });
      execSync(`xcrun simctl boot ${s.udid}`, { stdio: "pipe", encoding: "utf8" });
      // bootstatus blocks until the device is actually usable, not merely "Booted".
      execSync(`xcrun simctl bootstatus ${s.udid}`, { stdio: "pipe", encoding: "utf8", timeout: 300_000 });
      restarted.push(s.name);
    } catch (err: any) {
      return {
        name: "sim-boot-age", status: "fail", waited: true,
        message:
          `test canceled: failed to restart over-age simulator '${s.name}' ` +
          `(${err?.stderr?.toString().trim() || err?.message || err})`,
      };
    }
  }
  console.log(`✅  Simulator restart complete: ${restarted.map((n) => `'${n}'`).join(", ")} freshly booted.`);
  return {
    name: "sim-boot-age", status: "pass", waited: true,
    message: `restarted ${restarted.length} over-age sim(s): ${restarted.join(", ")}`,
  };
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

/**
 * Metro bundle-build gate (native e2e). `gateMetro` only proves Metro is *listening* (GET /status);
 * it does NOT prove Metro can BUILD a bundle for the target platform. The first dev-client launch
 * pays the full cold-build cost (observed ~27s for android) inside the flow's 60s "Log In" window —
 * if the build + dev-client reconnect overrun that window the app renders blank and the first test
 * fails for reasons unrelated to the app. This gate fetches the actual platform bundle, which:
 *   1) WARMS Metro's cache so the first real launch gets a fast bundle (fixes blank-screen-on-test-1),
 *   2) catches a broken JS graph early — a syntax/import error in the (merged) code returns 500 HERE,
 *      before any device work, turning an opaque blank-screen failure into a clear gate failure,
 *   3) records the cold-build time for visibility.
 * Skip for web (no Metro bundle). A non-2xx (e.g. 500 = build error) FAILS the gate.
 */
export async function gateMetroBundle(
  host: string,
  port: number,
  platform: "ios" | "android",
  opts: { timeoutMs?: number } = {},
): Promise<GateResult> {
  const url = `http://${host}:${port}/index.bundle?platform=${platform}&dev=true&minify=false`;
  const startedAt = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000) });
    const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
    if (res.ok) {
      return { name: "metro-bundle", status: "pass", waited: true,
        message: `${platform} bundle built + warmed in ${secs}s (HTTP ${res.status})` };
    }
    // Non-2xx: surface Metro's error head so a broken merge is obvious in the gate output.
    const body = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 300);
    return { name: "metro-bundle", status: "fail", waited: true,
      message: `test canceled: ${platform} bundle build failed — HTTP ${res.status} after ${secs}s${body ? ` — ${body}` : ""}` };
  } catch (err) {
    const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
    const msg = err instanceof Error ? err.message : String(err);
    return { name: "metro-bundle", status: "fail", waited: true,
      message: `test canceled: ${platform} bundle did not build within ${secs}s (${msg})` };
  }
}

/**
 * Driver-warmup gate (iOS e2e only). Absorbs the XCUITest driver cold start in a dedicated,
 * consequence-free launch so it can't fail the *first* real test for reasons unrelated to the
 * app. The startup-timeout budget is scaled by the current 1-min load — higher load buys a
 * longer wait — instead of a flat constant, and the wait is announced. On success the caller
 * tightens MAESTRO_DRIVER_STARTUP_TIMEOUT for the real tests (the driver persists across the
 * separate `maestro` processes, which is why a warm first run makes the rest fast). On failure
 * the suite should cancel: a wedged driver would otherwise spray false failures.
 *
 * MAESTRO_DRIVER_STARTUP_TIMEOUT is in milliseconds.
 */
export async function gateDriverWarmup(opts: {
  appId: string;
  flowPath: string;
  logFile: string;
  metroHost: string;
  metroPort: number;
  /** Pin warmup to the same device the tests use (UDID / adb serial). Empty = auto-select. */
  deviceId?: string;
  /** Where maestro --debug-output lands (default: ~/.maestro); caller flattens it. */
  debugOutput?: string;
  baseTimeoutMs?: number;
  maxTimeoutMs?: number;
  tightTimeoutMs?: number;
}): Promise<GateResult & { warmTimeoutMs: number; tightTimeoutMs: number }> {
  const cpus = os.cpus().length || 1;
  const load1 = os.loadavg()[0];
  const perCpu = load1 / cpus;
  const base = opts.baseTimeoutMs ?? 120_000;
  const cap = opts.maxTimeoutMs ?? 600_000;
  // Idle (perCpu≈0) → base; fully loaded (perCpu≈1) → 2×base; 2× overloaded → 3×base; capped.
  const warmMs = Math.min(cap, Math.round(base * (1 + Math.max(0, perCpu))));
  // Once warm, the driver is already up, so a real test only needs a short reconnect budget.
  const tightMs = opts.tightTimeoutMs ?? 60_000;

  console.log(
    `⏳  Warming the iOS XCUITest driver (one-time cold start). ` +
      `1-min load ${load1.toFixed(2)} on ${cpus} cores → budget ${(warmMs / 1000).toFixed(0)}s; ` +
      `real tests then use ${(tightMs / 1000).toFixed(0)}s. May take a couple of minutes on a loaded machine …`,
  );

  const res = spawnSync(
    "maestro",
    [...(opts.deviceId ? ["--device", opts.deviceId] : []),
      "test", opts.flowPath,
      "-e", `APP_ID=${opts.appId}`,
      "-e", `METRO_HOST=${opts.metroHost}`,
      "-e", `METRO_PORT=${opts.metroPort}`,
      ...(opts.debugOutput ? ["--debug-output", opts.debugOutput] : [])],
    { encoding: "utf8", env: { ...process.env, MAESTRO_DRIVER_STARTUP_TIMEOUT: String(warmMs) } },
  );
  try {
    appendFileSync(opts.logFile, `\n===== driver warmup (exit ${res.status}) =====\n${res.stdout ?? ""}${res.stderr ?? ""}`);
  } catch { /* best-effort log */ }

  if (res.status === 0) {
    return {
      name: "driver-warmup", status: "pass", waited: true,
      message: `XCUITest driver warm (cold start absorbed within ${(warmMs / 1000).toFixed(0)}s budget)`,
      warmTimeoutMs: warmMs, tightTimeoutMs: tightMs,
    };
  }
  return {
    name: "driver-warmup", status: "fail", waited: true,
    message:
      `test canceled: iOS driver did not warm up within ${(warmMs / 1000).toFixed(0)}s — see warmup.log. ` +
      `The simulator/driver may be wedged; \`xcrun simctl shutdown all\`, reboot the sim, and retry.`,
    warmTimeoutMs: warmMs, tightTimeoutMs: tightMs,
  };
}

/** Soft gate: back off while the machine is overloaded, then proceed (never cancels). */
export async function gateLoadAverage(opts: { maxPerCpu?: number; ceiling?: number; timeoutMs?: number } = {}): Promise<GateResult> {
  const cpus = os.cpus().length || 1;
  // An absolute `ceiling` (e.g. 75) takes precedence over the per-CPU multiple. This machine is
  // chronically loaded; a 2×cores=24 gate spent its budget waiting/warning for nothing.
  const ceiling = opts.ceiling ?? (opts.maxPerCpu ?? 2.0) * cpus;
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
