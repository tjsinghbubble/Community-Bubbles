# Device-tooling bug registry

Verified bugs in the Android **emulator** side of `scripts/manage_devices.py` and the
test runners, recorded **2026-06-26**. Native (real physical device) testing is the
priority, so these are **deliberately NOT fixed** — they are the seed list for future
regression tests and a later ATD/headless untangling pass.

**Status:** only bug **(a)** is fixed (via the `-gpu auto` decision). All others stand.
Each site carries an inline `# BUG-REGISTRY:<id>` comment where practical.

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
| i  | `-read-only` (+ `-no-snapshot-save`) is only set for `--start:headless`; it should be on ANY emulator used for testing, and `--bake` should then restart to clear both flags | `emulator_flags(headless=…)` (now CLI-unreachable) + bake path |
| j  | `-r -v` output is hallucinated/useless: omits ATD / Android version / API level / Google APIs vs Google Services / memory / gpu default, and repeats the device name across 3–4 columns | verbose running/list render |
| k  | `-c <name>` fails because it only knows how to copy from `~/.android/avd` | `clone_avd()` / `cmd_copy()` |
| l  | `--history <name>` has empty Detail/Duration/CPU/Load; some devices have no detail after a date; Detail not internally consistent; history doesn't infer apps started by hand via `emulator`/Device Manager | history write + `cmd_history()` render |

## Future tests (derived from this list)
When the internal harness (`scripts/check_tooling.zsh`) grows beyond native coverage,
each row above becomes a regression test asserting the CORRECT behaviour, so a fix can be
verified and not regress. Until then they remain documented, reproducible defects.
