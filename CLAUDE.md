# CLAUDE.md — AI Agent Context for Bubble

This file documents non-obvious architectural decisions that look like mistakes
but are intentional. Read this before modifying the files listed below.

---

## Tooling defaults — search/find/log tools (use these, not the defaults)

These tools are installed and on PATH. Reach for them FIRST; do not fall back to
`grep`/`find` out of habit. `rg` and `fd` compose well — `fd` selects the file
set, `rg` searches within it.

- **Search file contents → `rg` (ripgrep), never `grep`.** Faster, recursive by
  default, respects `.gitignore`.
- **Find files/dirs by name → `fd`, never `find`.** Faster, simpler syntax.
- **Read a window/region of a file around a pattern → the `find-within` skill**
  (wraps `find_within.py`), not a `grep -n | sed`/`awk` pipeline. Use for: the
  N lines around a match, a leading/trailing window, the span between two
  patterns (a function/handler body), match counts, or the last match in a log.
  It reads only the slice needed — fewer tokens, one permission prompt.
- **Logs:** `bunyan` to pretty-print JSON log streams; `lnav` to explore/filter
  log files interactively (syslog + json iOS styles). `jq` for JSON.

### `fd`/`rg` gotchas — required flags

1. **Both `fd` AND `rg` skip `.gitignore`d paths by default.** That hides
   content Claude often needs (`tmp/`, `tests/output/`, build artifacts,
   `.env`). When the target may be ignored, pass **`fd -I`** (`--no-ignore`) and
   **`rg -u`** (`--no-ignore`; `-uu` also unhides hidden/binary). Cut the usual
   noise back with excludes: `fd -I -E node_modules -E .git`,
   `rg -u -g '!node_modules'`.
2. **`fd` output ordering is non-deterministic** (parallel walk), unlike `find`.
   When order must be stable (diffs, comparisons, reproducible lists), pipe
   `fd … | sort`.
3. **`fd` exec has two forms:** `-x`/`--exec` runs the command **once per
   result** (like `find -exec`); `-X`/`--exec-batch` runs it **once** with all
   results as args. `--print0` (NUL-delimited output) and `--batch-size N`
   control I/O for downstream consumers.

---

## Ad-hoc Maestro runs — never write artifacts at the repo root

Preferred: run one-off flows through `npm run qa:flow -- <flow.yaml>
[--role role-user] [-e K=V …]`. It creates a dedicated
`tests/output/run-manual-<flow>-<UTC>/` dir, points SHOT_PREFIX inside it,
copies the flow + subflows next to the artifacts, and flattens Maestro's
`.maestro/tests/<timestamp>/` debris into shell-typeable names.

If you must invoke Maestro outside that wrapper (bare CLI `maestro test`,
Maestro MCP `run_flow`, or any one-off debug flow), every screenshot and debug
output MUST land under `tmp/maestro/`, never the repo root:

- `takeScreenshot:` in an ad-hoc flow → use a `tmp/maestro/<name>` path.
- CLI runs → pass `--debug-output tmp/maestro` and, for flows under
  `tests/e2e/`, `-e SHOT_PREFIX=tmp/maestro/`.

`tmp/` is excluded from git (`/tmp/` + root `/*.png` in .gitignore), Time
Machine, iCloud Drive sync, Spotlight, and PyCharm indexing. Screenshots
dumped at the repo root pollute git status, churn iCloud/backups, and have
been accidentally committed before. (The `npm run qa` runner already does this
correctly via run-scoped `tests/output/` dirs.)

Standing rule for any test output the platform creates: filenames must be
shell-typeable — route new output names through
`tests/runner/artifacts.ts:sanitizeFileName()` (see "Output naming" in
tests/README.md).

---

## Test runs and Maestro MCP — rules for AI agents

1. **Do not run full `npm run qa` suites in the agent conversation loop**
   unless there is no alternative. Launch them detached (background Bash, or a
   separate terminal) and poll cheaply with `npm run qa:status`
   (`scripts/testctl.py status --json`). Full runs streamed through the
   context window have blown token budgets before.

2. **MCP Maestro is for short start-stop bursts only** — verify a selector,
   inspect a hierarchy, then stop. Never interleave MCP device tools with a
   CLI `maestro test` run on the same simulator: the simulator-side XCUITest
   runner is a singleton and each new session kills the other side's driver
   (CLI pins host port 7001, MCP uses 22087 — the ports already differ, are
   not the conflict, and are not configurable). The qa runner auto-kills
   `maestro mcp` before iOS e2e runs. Doc-only MCP tools (query_docs,
   cheat_sheet, check_flow_syntax) are always safe. `inspect_view_hierarchy`
   output is huge — use it sparingly and prefer targeted asserts.

3. **Stuck or opaque runs**: diagnose with `npm run qa:status` /
   `npm run qa:health`; stop things with
   `python3 scripts/testctl.py nuke --nuke=<targets>` (see tests/README.md).
   Don't hand-roll pkill incantations.

---

## mobile/babel.config.js — NativeWind intentionally removed

The file does NOT include `jsxImportSource: "nativewind"` or the
`"nativewind/babel"` preset. **Do not add them back.**

NativeWind 4.x (`react-native-css-interop`) wraps every JSX element —
including `ScrollView`, `FlatList`, and `View` — with a `cssInterop`
`forwardRef` proxy, even when no `className` prop is present. In React Native
0.83.6 (New Architecture / Fabric), this proxy breaks the native gesture
recogniser chain that `ScrollView` requires, causing all scroll gestures to be
silently swallowed. The result is an app where nothing scrolls.

No `className` props exist anywhere in the mobile codebase, so removing the
NativeWind Babel transform has zero functional impact on styling.

---

## mobile/src/screens/main/ExploreScreen.tsx — Reanimated scroll handler

The scroll animation uses `useAnimatedScrollHandler` from
`react-native-reanimated`, not `Animated.event` from `react-native`.
**Do not revert to `Animated.event`.**

`Animated.event` with `useNativeDriver: false` routes scroll events through the
JS thread. In RN 0.83.6 Fabric's synchronous event dispatch model this causes
the same scroll-swallowing bug described above. The Reanimated handler runs on
the UI thread via JSI and is the correct approach for Fabric.

---

## mobile/package.json — react-native-worklets pinned to 0.7.x

`react-native-reanimated@4.2.x` declares `react-native-worklets >=0.7.0` as a
peer dependency, but its binary compatibility matrix only validates `0.7.x`.
Version `0.8.x` causes pod install to fail with:

```
[Reanimated] Failed to validate worklets version
```

The `overrides` block pins `react-native-worklets` to `0.7.4` to prevent
`npm update` from pulling in an incompatible version. **Do not remove the
overrides block or widen the version range** until `react-native-reanimated`
is upgraded to 4.3.x or later.

---

## mobile/package.json — build scripts use --no-bundler

```json
"ios":     "expo run:ios --no-bundler",
"android": "expo run:android --no-bundler"
```

The `--no-bundler` flag is intentional. These scripts only compile and install
the native binary. Metro is started separately via `npm run metro_bundler`.
Running both in the same process makes it harder to restart Metro independently
and mixes build output with runtime logs.

---

## Package updates in mobile/ — use npx expo install, not npm update

`npm update` in `mobile/` ignores Expo SDK compatibility constraints and will
pull in package versions that break the build (this is how the worklets
incident above occurred).

Always use:
```bash
npx expo install --fix              # align all packages to the installed SDK
npx expo install <package>          # add or update a specific package
```

`npm update` is safe at the project root for server-side packages only.

---

## server/sentry.ts — Sentry initialisation gating

Sentry is intentionally suppressed in local development unless the
`BUBBLE_SENTRY_USAGE=local` environment variable is set. The "SENTRY_DSN not
set" warning is also suppressed in plain local dev (it only appears when Sentry
was actually expected). This avoids noise in developer terminals. Do not revert
to initialising Sentry unconditionally on any non-production `NODE_ENV`.

---

## Expo Go — known broken for SDK 55

`test:e2e:expo` (targeting `host.exp.Exponent`) is non-functional. Expo Go
54.x does not support SDK 55, and Expo Go 55 was not yet available at the time
of writing. All mobile testing uses the native dev build
(`com.bubble.mobile`) built with `npm run mobile:build:ios-sim`.

# Token efficiency
Respond like smart caveman. Cut all filler, keep technical substance.
- Drop articles (a, an, the), filler (just, really, basically, actually).
- Drop pleasantries (sure, certainly, happy to).
- No hedging. Fragments fine. Short synonyms.
- Technical terms stay exact. Code blocks unchanged.
- Pattern: [thing] [action] [reason]. [next step].
