# Exported git stashes (2026-07-02)

Patch exports of the three stashes that were sitting in the old working copies,
preserved here for review while the docs/testing area is being reconciled.
Exported with `git stash show --include-untracked -p`; scanned for
secret-shaped strings before committing (clean). The stashes themselves were
NOT dropped — they still exist in the local stash list.

Apply one with `git apply docs/stashes/<file>.patch` (or `--3way` if it no
longer applies cleanly to today's tree).

| File | Stash | Made on branch | Date | 1-line summary |
|---|---|---|---|---|
| `stash-0-maestro-v2-rename-dev-scripts-and-port.patch` | `stash@{0}` | `feature/maestro-test-identifiers-v2` | 2026-05-19 | rename dev scripts and PORT env var (3 files, incl. the CLAUDE.md `mobile:start` → `metro_bundler` doc fix) |
| `stash-1-tj-test-db-wip.patch` | `stash@{1}` | `TJ-test,db` | 2026-04-30 | WIP on top of "Fix Maestro test commands and add mobile launch scripts" (29 files — the big one) |
| `stash-2-main-github-desktop.patch` | `stash@{2}` | `main` | 2026-02-24 | GitHub Desktop auto-stash (1 file) |
