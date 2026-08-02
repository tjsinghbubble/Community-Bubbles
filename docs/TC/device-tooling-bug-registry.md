# Device-tooling bug registry

Verified bugs in the Android **emulator** side of `scripts/manage_devices` and the
test runners, recorded **2026-06-26**. Native (real physical device) testing is the
priority, so these are **deliberately NOT fixed** — they are the seed list for future
regression tests and a later ATD/headless untangling pass.

**Status:** bugs **(a)** and **(i)** are fixed. All others stand.
Each site carries an inline `# BUG-REGISTRY:<id>` comment where practical.

**2026-07-08 — hold partially lifted (explicit task):** the start/warm/bake rework
re-enabled `--start:headless` and `--bake[:medium|:hot]`. Every start now waits for
readiness; `--warm:LEVEL` is gone (compiling + snapshot-writing belong to `--bake`
exclusively); the qa gate AOT-compiles the app-under-test per install
(`tests/runner/gating.ts`). The headless state resurfaced as a `Running (headless)`
State suffix in `-r`/`-l` — best-effort, so (b)/(e) remain open.

> Do not "drive-by" fix these while doing native work. If a native change happens to
> touch a site, leave the bug intact and keep the marker, unless the fix is the explicit
> task.

| id | symptom | code anchor (symbol, not line) |
|----|---------|--------------------------------|
| a  | **[FIXED]** forced deprecated `-gpu swiftshader_indirect` | `gpu_default()` / `emulator_flags()` — now `-gpu auto` (flag + `normalize_gpu_config()` config.ini) |
| b  | `--start` + `--start:headless` running together: `-r` shows BOTH as having a screen | `looks_headless()` / `_headless_marker()` / running-list render |
| c  | an ATD-image emulator started with `--start` runs, but tests fail and screenshots + movies fail | ATD image (`atd_ify()`) + e2e capture path; see [[project-android-screencap-black-all-gpu-modes]] |
| d  | an ATD-image emulator started with `--start:headless`: e2e continues regardless, all tests fail | headless start path + runner (no ATD/headless awareness) |
| e  | `-r` does not notice an ATD build and does not describe it as headless | running-list render / `looks_headless()` |
| f  | `-r` shows alias `android` = Charlotte, but `--start android` starts a RANDOM emulator, not Charlotte | alias resolution in `resolve_many()` for the `android` system alias vs `cmd_start` |
| g  | `-k` during an e2e run: the runner doesn't notice the emulator is gone, continues remaining tests, all fail with no clear reason | `tests/runner/qa.ts` serial e2e loop (single resolve, cached); no mid-run liveness recheck |
| h  | the test runners don't notice when an emulator is `-no-window` or ATD | `run-flow.ts --require-screen` / android emulator-booted gate in `gating.ts` |
| i  | **[FIXED 2026-07-08]** `-read-only` (+ `-no-snapshot-save`) was only set for `--start:headless` | `emulator_flags()` — every non-bake start now passes `-no-snapshot-save` (headless adds `-read-only`); `--bake` is the only writable boot and the only writer of `default_boot` |
| j  | `-r -v` output is hallucinated/useless: omits ATD / Android version / API level / Google APIs vs Google Services / memory / gpu default, and repeats the device name across 3–4 columns | verbose running/list render |
| k  | `-c <name>` fails because it only knows how to copy from `~/.android/avd` | `clone_avd()` / `cmd_copy()` |
| l  | `--history <name>` has empty Detail/Duration/CPU/Load; some devices have no detail after a date; Detail not internally consistent; history doesn't infer apps started by hand via `emulator`/Device Manager | history write + `cmd_history()` render |

## Future tests (derived from this list)
When the internal harness (`scripts/check_tooling.zsh`) grows beyond native coverage,
each row above becomes a regression test asserting the CORRECT behaviour, so a fix can be
verified and not regress. Until then they remain documented, reproducible defects.
