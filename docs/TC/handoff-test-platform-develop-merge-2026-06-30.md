# Handoff — Test platform → develop merge (2026-06-30)

## TL;DR

Merged `origin/develop` into the test platform and proved the **merge + API layer** are sound.
Open as **draft PR #91** (`reconcile/test-platform-into-develop` → `develop`).
Remaining: **native build proofs**, **native e2e smoke**, and **P7 housekeeping**.

- PR: https://github.com/tjsinghbubble/Community-Bubbles/pull/91
- Branch: `reconcile/test-platform-into-develop` (HEAD `d64b160`)
- Plan file: `~/.claude/plans/spicy-tickling-duckling.md`
- Cross-refs: [[project_develop_merge_gotchas]], [[project_test_platform_handoff]],
  [[project_e2e_flows_ios_tuned]], [[project_android_e2e_handoff]], [[project_qa_server]],
  [[project_testctl]], [[project_ios_smoke_baseline_2026-06-17]]

## Update — session 2 continuation (2026-06-30, P5/P6/P7)

Picked up the resume list. Net: **P7 done, P5 proven, P6 blocked by a pre-existing dev-client
fragility (not the merge)**. New commits on the branch (newest first):

- `563beae` feat(qa): **metro-bundle gate** — warm Metro + catch a broken JS graph (500) before e2e
- `a056f8b` docs(future-tests): ft-0006 (mobile Sentry tsc gap) + ft-0007 (testctl nuke `mcp` gap)
- `420ee0a`..`a18e042` **P7 housekeeping** — all 17 untracked drafts filed in 4 clean commits
  (docs/TC tc-tracker+handoffs, docs/research+ASTF+signup-genius, docs/script analysis JSONs, tooling zsh helpers)

**P5 — build proofs: PASS (honest, efficient).** Root `tsc` GREEN. The merge has **zero native-dep
changes** (`mobile/package.json` delta is script-only: `flag-temp-files.sh`→`.zsh`), so the existing
`mobile/ios`+`mobile/android` dirs stay valid — a full `expo run:*` recompile re-proves nothing.
Metro one-shot `expo export` bundled the **full merged module graph** → Hermes bytecode, 0 errors.
Mobile `tsc` fails on **pre-existing develop** Sentry-API drift (ft-0006), not the merge. Gaps not
attempted (as planned): iOS signing/certs, `eas build --local` (unconfigured), EAS cloud.

**P6 — android e2e smoke: BLOCKED, root-caused.** Ran twice on `Charlotte` (Pixel_10, google_apis,
not Play). All 10 gates green incl. schema-drift=`cb3f965e`, seeded-account auth, app-installed.
But **every** test fails at `login-as` step 1: after `reconnect-metro` (clearState→openLink), the app
renders the RN RedBox **"Unable to load script … loadJSBundleFromAssets"** — the dev client does NOT
reconnect to Metro after clearState wipes its URL, and falls back to an absent embedded bundle.
Ruled out: cold-build (new metro-bundle gate pre-warmed it, HTTP 200 0.1s, failure persisted),
adb reverse (8081+3000 forwarded), and the merge (all non-dev-client layers green). **This is the
documented Expo dev-client reconnect hazard, NOT a merge regression.** Full detail = **ft-0008**.

**Robust fix = Mode B (release/embedded bundle)** per the native-device-tooling plan Phase 8 — the
bundle ships in assets so there's no Metro/reconnect step. Recommended next action for native e2e.

**Remaining before PR-ready:** decide Mode-B-vs-dev-client-fix for native e2e (ft-0008); the merge
itself is validated at every layer that doesn't depend on the dev-client reconnect.

---

## Done this session (P0–P4 + merge + API smoke)

7 new commits on the branch (newest first):
- `d64b160` refactor(server): dedupe duplicate suspended_* ALTER in auto-migrate
- `b2159d0` docs(future-tests): seed notes-for-future-tests.json
- `59e328b` test(e2e): repair + harden ba-0600 (fixed broken YAML: empty `id:`, mis-nested setLocation)
- `584df1a` fix(tooling): portable lockfiles (firewall→npmjs) + flag-temp-files debug() return 0
- `1617205` chore(tooling): iCloud sync-ignore fix + watchman excludes; drop dead script
- `1a9e555` test(e2e): android-robustness for login-as + auth-0200
- `e9c3047` **chore: merge origin/develop (a62dbac)** — THE reconcile (1 conflict: jest.config.js)

Verified: root `tsc` green · root+mobile `npm install` clean · `bubble_test` has all social+suspended
cols · schema baseline re-recorded (`schema-sig=cb3f965e`) · **API/headless smoke 23/23 pass, 0 fail**.

## Current machine/repo state

- On branch `reconcile/test-platform-into-develop`, tree clean except **17 untracked** P7 draft
  docs/scripts (docs/TC/*, docs/script/, docs/research/, docs/signup-genius-*, scripts/maestro_*.zsh, etc.).
- **Safety net (local tags):** `backup/ctp-pre-merge` (pre-merge tip e770bf5), `backup/develop-pinned` (a62dbac).
  Recover: `git reset --hard backup/ctp-pre-merge`.
- `bubble_test` DB migrated to the merged schema; baseline in `meta.n` = cb3f965e.
- qa:server NOT running. No background jobs left.
- ba-0600 WIP stash was consumed (popped + repaired). Remaining `git stash list` entries are old/unrelated.

## Resume — next steps (in order)

### P5 — Native build proofs (feasible-local, log honest gaps)
```
npm run type-check                      # sanity
npm run metro_bundler                   # separate terminal (scripts use --no-bundler)
npm run mobile:build:ios-sim            # expo run:ios --no-bundler  (needs Xcode/sim)
npm run mobile:build:android-emu        # expo run:android --no-bundler (needs emu; ATD Lainey is lighter)
```
Gaps to LOG, not attempt: iOS prod signing/certs; `eas build --local` (NOT configured anywhere — net-new);
EAS cloud builds (out of scope).

### P6 — Native e2e smoke (beat the 6/7 Android baseline; ba-0600 was the fail)
```
# server first (serves bubble_test):
npm run qa:server &                      # already dual-stack (API_BIND_HOST=::)
# iOS:
npm run qa -- --layer e2e --platform ios
# Android (use a real device or the ATD; Play image wedges SystemUI under load):
npm run qa -- --layer e2e --sim <android-device>     # --sim implies platform
npm run qa:status                        # poll; DON'T stream full runs in-context
```
Triage rule: confirm non-passes are **bad-selectors**, not logic. BEFORE counting auth-0200 as a real
fail, verify `button-select-gender`/`button-select-dob`/`input-name` exist on the merged signup screens
(Maestro MCP, start-stop burst). See note ft-0005 in `docs/future-tests/notes-for-future-tests.json`.

### P7 — Housekeeping (the 17 untracked + bucket decisions)
- Flag WIP/excluded: `scripts/local_bubble_health`, `scripts/remote_health.py` (machine-specific hardcoded hosts).
- Bring draft docs into `docs/`: signup-genius-take-*, docs/research/, docs/endpoints-for-ASTF.txt,
  the docs/TC/* handoffs (incl. this one), docs/script/*-analysis.json.
- Archive-worthy templates (`scripts/_*_template.md`, `tests/plan/PROMPT_TEMPLATE.md`) → archive dir.

### Then: mark PR ready for review.

## Gotchas to remember (full detail in [[project_develop_merge_gotchas]])

1. **NEVER diff/merge against local `main`** — it's months stale. Use `origin/develop` (or `origin/main`).
2. **develop drift**: if re-merging, re-check `git rev-parse origin/develop` vs the pin and re-run
   `git merge-tree` before trusting the 1-conflict assumption.
3. **Firewall lockfile URLs** reappear on any new develop merge — rewrite
   `package-firewall.replit.local/npm/` → `registry.npmjs.org/`.
4. **iCloud ` 2` dupes** spawn when checking out develop's new files under ~/Documents — delete the
   ` 2` copies (NUL-safe), never blanket `git clean` (eats untracked drafts).
5. **Maestro gate**: the qa runner refuses to start if **Maestro Studio.app** is open — quit it
   (`osascript -e 'tell application "Maestro Studio" to quit'`); `testctl nuke maestro` only kills CLI runners.
6. **Schema-drift gate**: after any schema change, re-baseline with
   `TEST_DATABASE_URL=postgresql://localhost:5432/bubble_test npm run qa:provision` (records meta.n).
7. **Provision's `drizzle-kit push`** prompts (non-TTY → errors) on the google_id/apple_id unique:
   migration made a PARTIAL index, schema.ts declares `.unique()` (full). Harmless to the baseline
   step; real fix tracked as note ft-0003.

## Open review flags on the PR

- The merge is the only thing needing careful review: `git show e9c3047`.
- (RESOLVED this session) duplicate suspended_* ALTER deduped in d64b160.
