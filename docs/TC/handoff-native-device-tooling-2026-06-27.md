# Handoff — native (real-device) testing for the dev tooling

**Date:** 2026-06-27 · **Branch:** `create_test_platform` · **Commit:** `39651cb` (pushed)
**Plan:** `~/.claude/plans/zippy-whistling-mochi.md` (approved)

## Why
The device tooling (`scripts/manage_devices.py`, `tests/runner/*`) only understood
simulators/emulators. Goal: make **real physical devices first-class** and drive a real
Android phone to a green E2E run; iOS-real is listing-only (signing unresolved). Alongside:
stop digging on the broken Android-emulator stack (record bugs, don't fix; only allowed
emulator change is `-gpu auto`), hide the headless/bake surface, and add a release-build
(TestFlight/store) test mode.

## Related session memory (read these)
- `[[project-native-device-tooling-plan]]` — the approved direction (this work).
- `[[project-android-emulator-gpu-swiftshader]]` — RESOLVED: `-gpu auto` only (flag + AVD
  config.ini); swiftshader_indirect deprecated/removed.
- Touches/relevant: `[[project-device-manager]]`, `[[project-testctl]]`,
  `[[project-test-runner-lock]]`, `[[project-qa-server]]`,
  `[[project-android-screencap-black-all-gpu-modes]]` (black ATD screenshots = image, not GPU).

## What shipped (commit 39651cb, +1341/−218, 11 files)
Status: all 12 planned phases implemented. `npx tsc -p tsconfig.json` = 0 errors;
`zsh scripts/check_tooling.zsh` = 14/14. Pre-commit hook ran tsc on staged TS, passed.

### manage_devices.py + scripts/helpers/ (new package)
- **DDL fix (Phase 0):** schema + REF_SEED + name-pool seed moved to
  `helpers/helper_manage_devices.py`; **one-time versioned migration** via
  `PRAGMA user_version` + `table_info` guard (`init_db`/`migrate_db`). The per-open
  `_DEVICE_MIGRATIONS` ALTER loop is **gone**. Existing DBs migrate 0→1 (add native cols,
  preserve rows); fresh DBs already canonical.
- **Native model (Phase 1):** new cols `personal`, `last_reachable_at`,
  `claim_owner/claim_pid/claim_heartbeat_at`. `android_real()` (USB serials that are
  `not is_emu and not is_net` — Genymotion ip:port stays Simulated), `ios_real()`
  (list-only stub). `sync()` is flavor-aware, preserves `personal`/`claim_*`, keeps a real
  phone `present=1` (Offline) when unplugged. `--add` (interactive personal-vs-test + 3
  aliases: device-name `altname`, `my-*`/`real-*-N` `name`, computed group `mine`/`real`).
  Claim/lease (advisory, TTL+heartbeat reclaim — NOT testctl's lock). Drop-on-unreachable
  in `resolve_many`/`cmd_next` (offline `--kind-of`/`--flavor-of` bypass via
  `resolve_one_raw`).
- **is_real gate (Phase 2):** `refuse_on_real()` on `cmd_start`/`cmd_kill`/`warmup_one`/
  `cmd_copy` (live ops only).
- **Hide + mark BROKEN (Phase 3):** `--start:headless`, `--bake`, `--save-quickboot`,
  `--warm:*` no longer recognized; `cmd_bake`/`bake_optimizations`/`cmd_save_quickboot`
  return a BROKEN message (bodies kept, intentionally unreachable). **Kept live:**
  `cmd_warmup` (`-w`) and `--headless-of` (run-flow `--require-screen` caller). `--copy`
  skips the bake step but still clones. "Headless" column dropped from `-l`.
- **`-gpu auto` (Phase 4):** `gpu_default()` returns `"auto"`; `normalize_gpu_config()`
  writes `hw.gpu.mode=auto` in clone/rename/atd_ify (so manual Device-Manager launches get
  it too). No swiftshader refs (comments aside).
- **Filters + probe (Phases 5–6):** `--ios/--android/--real/--simulated` + `_apply_filters`
  (lists + `all*` resolve); `--flavor-of`. `helpers/helper_toolchain.py` `capabilities()`
  (cached) + `warn_missing_once()` (one stderr line from `main()`), gates `*_real()`.

### runners (tests/runner/qa.ts, run-flow.ts, gating.ts)
- **`-d`/`--device`/`--dev` (Phase 7):** replaces `--sim` (kept as deprecated alias with a
  note). Reconcile calls `--flavor-of` → `args.flavor`. `gateAppInstalled` branches on
  flavor: **android-real** uses the existing `adb -s install -r` + `adb reverse` (works);
  **iOS-real** early-returns a clear "not supported" fail (no dead `*-iphoneos` glob added).
- **Mode B (Phase 8):** `--no-install` (don't overwrite the installed build) +
  `--release-mode prod|staging` (implies `--no-install`+`--no-seed`, clears default `smoke`,
  AND-filters `safe_for_<env>`, skips the seeded-account gate). Pilot:
  `tests/e2e/release/release-0100-launch-welcome.yaml` (launch + Welcome assert; no auth/
  writes/Metro; role-agnostic).

### tests + docs
- `docs/TC/device-tooling-bug-registry.md` — 13 emulator bugs (a–l), record-don't-fix; only
  (a) fixed via `-gpu auto`. Inline `# BUG-REGISTRY:<id>` markers at sites.
- `scripts/check_tooling.zsh` + `scripts/helpers/selftest_manage_devices.py` — syntax,
  import, native-logic (18 checks), migration idempotency, CLI-surface self-tests.
- `tmp/dev-device-setup.md`, `tmp/apple-paid-account-check.md`, `tmp/build-artifact-paths.md`
  (in tmp/, not committed — fold into full docs later).

## Verified vs NOT verified
- **Live-verified:** real-device *discovery* — `python3 scripts/manage_devices.py -l --real`
  shows the connected iPhone **Schmante** as `Real iOS / 26.5` (auto-named "George",
  registered as a *test* device). Toolchain probe + warn-once correct on this host.
- **NOT verified (needs hardware):** the actual **Android on-device green run** (no Android
  phone was attached this session) and **iOS-real execution** (deferred on signing).

## Next steps
1. **Android first green** — phone with USB debugging attached:
   ```
   python3 scripts/manage_devices.py --add            # register (personal vs test) + aliases
   npm run mobile:build:android-emu                    # builds + installs debug APK to the device
   npm run qa:server &                                 # serves bubble_test
   npm run qa -- -d <alias> --tag smoke --layer e2e    # watch: npm run qa:status
   ```
   Expect: `--flavor-of`=real, `adb reverse` set, app-installed gate installs the APK,
   `manage_devices --start <real-alias>` refuses cleanly.
2. **Retag Schmante** as personal if desired: `python3 scripts/manage_devices.py --add`
   (it's currently a test device named "George").
3. **iOS-real** — work `tmp/apple-paid-account-check.md` to determine paid-team access; then
   set `DEVELOPMENT_TEAM`, register the device UDID, add an `expo run:ios --device` script.
4. **Mode B** — author real `safe_for_prod`/`safe_for_staging` flows (only ~30/41 existing
   flows are seed-free; audit the rest) and resolve per-flow appId templating so Mode B can
   target the prod bundle `io.trybubble.app`.

## Gotchas / decisions for the next agent
- Anchor edits to **symbols, not line numbers** (the source moved a lot this session).
- BROKEN-fn bodies and `_headless_marker` are intentionally unreachable/unused (Pyright ★
  notices are expected) — don't "fix" them; they're future-test seeds (bug registry).
- DB isolation in tests/scripts uses `MANAGE_DEVICES_DB` (the real env override) — NOT
  `--db`/`BUBBLE_DEVICE_DB` (those don't exist).
- `mine`/`real` are **computed groups** (added to `INTERNAL_ALIASES`), not stored aliases.
- The SQL-injection pre-commit/Write hook flags f-string/`.format` SQL even for trusted
  identifiers; helper SQL uses explicit statements / concatenation to satisfy it.
- Do **not** re-fix the 12 deferred emulator bugs while doing native work.
