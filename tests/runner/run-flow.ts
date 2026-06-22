/**
 * run-flow — manual single-flow Maestro wrapper with runner-grade artifact hygiene.
 *
 * `maestro test` run by hand dumps shell-hostile filenames under ~/.maestro (or worse, the
 * repo root). This wrapper gives a one-off flow the same treatment the qa runner gives a
 * suite: a dedicated tests/output/run-manual-<flow>-<UTC>/ directory, SHOT_PREFIX pointed
 * inside it, the flow yaml (+ referenced subflows) copied next to the artifacts, and the
 * .maestro/tests/<timestamp> debris flattened into typeable, function-first names.
 *
 * Usage:
 *   npm run qa:flow -- tests/e2e/events/events-0500-create-event-smoke.yaml [options]
 * Options:
 *   --role <role-*>     inject EMAIL/PASSWORD/ROLE from config/roles.json
 *   --env <name>        environment from config/environments.json (default: local)
 *   --platform <ios|android|web>   target platform (default: ios)
 *   --sim, --simulator <id>  pin to a specific device by id/alias (default: the
 *                      platform alias 'ios'/'android' via manage_devices --resolve)
 *   -e KEY=VAL          extra Maestro env vars (repeatable)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { sanitizeFileName, flattenMaestroDebugOutput, copyFlowSources, headlessShotMode, stubHeadlessScreenshots, excludeFromICloud, acquireRunnerLock } from "./artifacts.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TESTS_ROOT = join(__dirname, "..");
const REPO_ROOT = join(TESTS_ROOT, "..");
const OUTPUT_ROOT = join(TESTS_ROOT, "output");

function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z").replace("T", "t");
}

function main(): void {
  const argv = process.argv.slice(2);
  let flowPath = "";
  let role = "";
  let envName = "local";
  let platform = "ios";
  let platformExplicit = false;
  let sim = "";
  let requireScreen = false;
  const extraEnv: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--role") role = argv[++i];
    else if (a === "--env") envName = argv[++i];
    else if (a === "--platform") { platform = argv[++i]; platformExplicit = true; }
    else if (a === "--sim" || a === "--simulator") sim = argv[++i];
    else if (a === "--require-screen") requireScreen = true;
    else if (a === "-e") extraEnv.push(argv[++i]);
    else if (a === "--help" || a === "-h") { console.log("usage: npm run qa:flow -- <flow.yaml> [--role role-*] [--env local] [--platform ios|android|web] [--sim <id> (implies --platform)] [--require-screen] [-e K=V ...]"); return; }
    else if (!flowPath) flowPath = a;
    else console.warn(`(ignoring unknown arg: ${a})`);
  }
  if (!flowPath) { console.error("error: no flow yaml given"); process.exit(2); }
  flowPath = resolve(flowPath);
  if (!existsSync(flowPath)) { console.error(`error: no such flow: ${flowPath}`); process.exit(2); }

  // Mutual-exclusion gate: refuse to start if another test runner (qa / another qa:flow / a
  // stray maestro) is already running — they collide on bubble_test/Metro and the device driver.
  // (bench_flow.zsh and the testctl zsh wrappers go through qa:flow, so this covers them too.)
  // Released on exit.
  acquireRunnerLock(REPO_ROOT, "qa:flow", ["npm run qa:flow --", ...process.argv.slice(2)].join(" "));

  const envCfg = JSON.parse(readFileSync(join(TESTS_ROOT, "config/environments.json"), "utf8")).environments[envName];
  if (!envCfg) { console.error(`error: unknown env '${envName}'`); process.exit(2); }

  // --sim implies its platform; --platform+--sim must agree (same rule as the qa runner).
  // Without this, `--sim <android-avd>` kept platform=ios and ran iOS flows on the emulator.
  if (sim && platform !== "web") {
    const k = spawnSync("python3", [join(REPO_ROOT, "scripts/manage_devices.py"), "--kind-of", sim], { encoding: "utf8" });
    const kind = (k.stdout ?? "").trim();
    if (k.status !== 0 || (kind !== "ios" && kind !== "android")) {
      console.error(`error: --sim '${sim}' could not be resolved to a device: ${(k.stderr ?? "").trim() || "unknown"}`);
      process.exit(2);
    }
    if (platformExplicit && platform !== kind) {
      console.error(`error: --platform ${platform} conflicts with --sim '${sim}', which is an ${kind} device.`);
      process.exit(2);
    }
    platform = kind;
  }

  const flowName = sanitizeFileName(basename(flowPath).replace(/\.ya?ml$/, ""));
  const leaf = sanitizeFileName(role ? `${flowName}-${role}` : flowName);
  const startedAt = new Date();
  const runDir = join(OUTPUT_ROOT, `run-manual-${flowName}-${utcStamp(startedAt)}`);
  mkdirSync(runDir, { recursive: true });
  excludeFromICloud(runDir);   // keep manual-run artifacts out of iCloud sync (repo is in ~/Documents)
  copyFlowSources(flowPath, runDir, join(TESTS_ROOT, "e2e"));

  // qa-id / qa-reason from the flow header, so testctl reconstructs the source + names the
  // test the same way it does for a qa-suite run (falls back to the flow filename).
  const flowText = readFileSync(flowPath, "utf8");
  const qaId = (flowText.match(/#\s*qa-id:\s*(\S+)/) || [])[1] || flowName;
  const qaReason = (flowText.match(/#\s*qa-reason:\s*(.+)/) || [])[1]?.trim() || "";
  const gitSha = (spawnSync("git", ["rev-parse", "--short", "HEAD"],
    { cwd: REPO_ROOT, encoding: "utf8" }).stdout ?? "").trim();

  const args = ["test", flowPath,
    "-e", `APP_ID=${envCfg.appId}`,
    "-e", `METRO_HOST=${envCfg.metroHost}`,
    "-e", `METRO_PORT=${envCfg.metroPort}`,
    "-e", `SHOT_PREFIX=${join(runDir, leaf + "-")}`,
    "--debug-output", runDir];
  if (role) {
    const r = JSON.parse(readFileSync(join(TESTS_ROOT, "config/roles.json"), "utf8")).roles[role];
    if (!r) { console.error(`error: unknown role '${role}'`); process.exit(2); }
    args.push("-e", `EMAIL=${r.email}`, "-e", `PASSWORD=${r.password}`, "-e", `ROLE=${role}`);
  }
  for (const kv of extraEnv) args.push("-e", kv);
  if (platform !== "ios") args.unshift("--platform", platform);

  // Pin the device so maestro doesn't auto-select among all connected devices (which ran
  // iOS flows on a booted Android emulator). Resolve the platform alias by default; web
  // has no device to pin.
  let resolvedDeviceId = "";
  let resolvedDeviceName = "";
  if (platform !== "web") {
    const simId = sim || platform;
    const r = spawnSync("python3", [join(REPO_ROOT, "scripts/manage_devices.py"), "--resolve", simId],
      { encoding: "utf8" });
    resolvedDeviceId = (r.stdout ?? "").trim();
    if (r.status === 0 && resolvedDeviceId) {
      args.unshift("--device", resolvedDeviceId);
      // The stable device name (AVD/iOS name) — recorded below so testctl labels the run by
      // device, not the reused adb serial.
      resolvedDeviceName = (r.stderr ?? "").match(/name="([^"]+)"/)?.[1] ?? "";
      console.log(`🎯  ${resolvedDeviceId}  ${(r.stderr ?? "").trim()}`);
    } else {
      console.error(`error: could not resolve device '${simId}': ${(r.stderr ?? "").trim()}`);
      process.exit(2);
    }

    // --require-screen: refuse to run on a headless device. A -no-window Android emulator
    // returns BLACK screenshots/recordings here (swiftshader), so a debug re-run that wants
    // to SEE the screen (noisy/movie/cmd) must fail loudly rather than capture black frames.
    if (requireScreen) {
      const h = spawnSync("python3", [join(REPO_ROOT, "scripts/manage_devices.py"), "--headless-of", simId],
        { encoding: "utf8" });
      const mode = (h.stdout ?? "").trim();
      if (mode === "headless" || (mode === "unknown" && platform === "android")) {
        console.error(`error: --require-screen: device '${simId}' is ${mode === "headless" ? "headless (-no-window)" : "not confirmed windowed"} — screenshots/recordings would be BLACK.`);
        console.error(`       boot it WINDOWED first:  python3 scripts/manage_devices.py --kill ${simId} && python3 scripts/manage_devices.py --start ${simId}`);
        process.exit(2);
      }
    }
  }

  // run-params.json so testctl lists this manual run (its recent-runs table skips dirs
  // without one). Written BEFORE the run, so a crash still leaves the run discoverable.
  writeFileSync(join(runDir, "run-params.json"), JSON.stringify({
    startedAt: startedAt.toISOString(),
    gitSha, env: envName, apiBaseUrl: envCfg.apiBaseUrl ?? "",
    platform, deviceId: resolvedDeviceId, sim, deviceName: resolvedDeviceName,
    roles: role ? [role] : [], layers: ["e2e"],
    selectedTestIds: [qaId], manual: true,
  }, null, 2) + "\n");

  console.log(`📁  ${runDir}`);
  const res = spawnSync("maestro", args, { cwd: REPO_ROOT, stdio: "inherit" });
  flattenMaestroDebugOutput(runDir, leaf);
  // Maestro's last console line points at the .maestro/tests/<ts> dir the flatten just removed.
  console.log(`📁  debug output flattened into ${runDir} (any .maestro/tests path above is gone)`);

  // T8: a headless emulator (-no-window) yields all-black screenshots. Replace those
  // useless large PNGs with a tiny warning stub. Gated by QA_HEADLESS_SCREENSHOTS
  // (auto|stub|keep|skip; default auto = stub black shots only on a headless device).
  // android is the headless platform on this host; the decode-check ensures a real
  // (non-black) image is never stubbed under "auto".
  const shotMode = headlessShotMode(process.env.QA_HEADLESS_SCREENSHOTS);
  const n = stubHeadlessScreenshots(runDir, shotMode, platform === "android");
  if (n > 0) console.log(`🖤  ${n} black headless screenshot(s) replaced with .BLACK.txt stubs (QA_HEADLESS_SCREENSHOTS=${shotMode})`);

  // T10: record the device this run actually used as the platform's last-used, so a later
  // `manage_devices --resolve last-android` (or last-ios) points back at it. Side-effect
  // only (no stdout id), best-effort — never fail the run on this.
  if (platform !== "web" && (res.status ?? 1) === 0) {
    const simId = sim || platform;
    spawnSync("python3", [join(REPO_ROOT, "scripts/manage_devices.py"), "--mark-used", simId],
      { stdio: "ignore" });
  }

  // Minimal summary.json (new meta-nested shape) so testctl shows a real result/run-time
  // and the per-test inspector works on a manual run exactly like a qa-suite one.
  const finishedAt = new Date();
  const passed = (res.status ?? 1) === 0;
  writeFileSync(join(runDir, "summary.json"), JSON.stringify({
    meta: {
      runId: basename(runDir), startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(), canceled: false,
      totals: { total: 1, targeted: 1, passed: passed ? 1 : 0,
        failed: passed ? 0 : 1, knownBugs: 0, findings: 0 },
    },
    gates: [],
    results: [{
      id: qaId, tool: "maestro", layer: "e2e", role: role || null,
      tags: ["e2e", platform, ...(role ? [role] : [])],
      status: passed ? "pass" : "fail",
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      expectedFinding: false, knownBug: false,
      reason: qaReason, artifactsDir: runDir,
      message: "(manual qa:flow run)",
    }],
  }, null, 2) + "\n");

  process.exit(res.status ?? 1);
}

main();
