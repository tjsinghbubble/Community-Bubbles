# Handoff — android e2e investigation (2026-06-20)

Session paused by request ("stop here, leave clean"). Environment is clean: no emulators, no
qemu, no iOS sims, no qa/maestro processes running.

## What this session did (committed + pushed, branch `create_test_platform`)
- `3a87ba1` — qa/devices: `--sim` infers `--platform` (+ mismatch abort); testctl labels runs by
  recorded device name (not the reused adb serial); `manage_devices --kind-of`; warmup false-ready
  fix; `--rename`; Last-Used `(HH:MM)`; Ready col `baked/level`; testctl status A–I polish; bench
  hardening.
- `ef77edb` — bench load guard (`LOAD_WARN`/`LOAD_PAUSE`), `BENCH_SCOPE=smoke|all`, iOS-tolerant
  bench preflight, `excludeFromICloud` (runner stamps `com.apple.fileprovider.ignore#P` on each run
  dir; 151 existing dirs back-filled).
- New: `scripts/bench_flow.zsh`.

## Bench results (analyzed)
Compile level (low/medium/hot/none) is **boot-blind and headless-blind**: clean quick-boot ~9–11s
and headless ~13–21s regardless of level. JoeJr's overnight boot failure was a **torn default_boot
snapshot** (0-byte textures.bin) — re-baked clean this session, confirming the root cause.

## Task A (get android smoke e2e >5/7) — NOT achieved; root cause is foundational
The "5 failing tests" are really ONE shared `login-as.yaml` failure. Login fails on this host for
**three independent reasons**, alternating per run:
1. **RN render** (welcome screen) intermittently exceeds even 60s — root cause is **swiftshader
   software GPU** rendering RN Fabric on this Intel Mac (black framebuffer + empty a11y tree).
2. **Soft keyboard occludes `input-password`** (confirmed via screenshot). Fix written but UNVERIFIED.
3. **Maestro android driver wedges** mid-run (`AndroidInstrumentationSetupFailure`/gRPC UNAVAILABLE)
   — partly from abrupt kills (corrected), but recurred on a clean start.

**Key implication for the compile-level experiment (B):** the android e2e suite is **GPU-render-bound
(swiftshader)**, not native-exec-bound. `warm:hot` speeds Java/native exec, NOT GPU rendering — so
suite timing likely can't confirm "warm:hot helps" here, same level-blindness as boot/headless for a
different reason.

## UNCOMMITTED, UNVERIFIED (working tree)
`tests/e2e/common/login-as.yaml`:
- `hideKeyboard` after email + after password (fixes the confirmed keyboard occlusion — sound, but
  never ran clean end-to-end because #1/#3 killed every attempt).
- welcome + post-login waits bumped 30s → 60s (tolerance for slow render).
→ Verify on a clean green run before committing (or revert). Also: a live `show_ime_with_hard_keyboard=0`
was set on a (now shut-down) sim — harmless, not persisted.

## Next-step options (user to choose later)
- Verify the login fixes in isolation (windowed run, pre-reset driver, load guard) to close A's
  diagnosis; then decide on B.
- Invest in android e2e infra: token-injection login bypass + maestro driver auto-recovery gate.
- Pivot: accept render-bound limit; iOS for e2e breadth + android for headless/boot only.

## Session memory files (the full context behind each item)
- [[project-bench-overnight-handoff]] — corrected overnight eval + all tooling fixes
- [[project-cold-launch-compile-experiment]] — rescoped: compile-level SUITE-timing, gated on A
- [[project-e2e-infra-design-backlog]] — token-injection vs baked-login; debug-decorator
- [[project-maestro-driver-teardown-recovery]] — graceful kill + driver auto-recovery (the #3 fix)
- [[project-testctl-unaware-of-benchmarks]] — bench heartbeat TODO
- [[project-test-image-corruption]] — fault-injection bench TODO
- [[project-ios-speedups-todo]] — iOS has no compile/bake analog
- [[feedback-handoff-doc-references-memory]] — this doc's own convention
