#!/usr/bin/env zsh
# PreToolUse(Bash) warn-mode nudge.
#
# Fires when a Bash command uses grep/find at command-head position and injects a
# reminder (rg/fd/find-within) into Claude's context via `additionalContext`.
# WARN-MODE: the tool still runs — this does NOT block and does NOT emit a
# permissionDecision, so existing permission prompts are left untouched.
#
# Also appends one line per fire to ~/.claude/hook-nudges.jsonl as a usage ledger,
# because Claude Code keeps no built-in tally of tool/skill/hook usage.
#
# Contract (verified against CC hooks docs):
#   stdin  = PreToolUse JSON (.tool_input.command, .session_id, .cwd, ...)
#   stdout = exit-0 JSON with hookSpecificOutput.additionalContext
emulate -L zsh
set -o pipefail

input="$(cat)"
command_str="$(printf '%s' "$input" | jq -r '.tool_input.command // ""')"

# Match grep/egrep/fgrep/find ONLY at command-head position — start of string/line,
# or right after a pipe/semicolon/ampersand. This avoids false fires on:
#   `git grep ...`  (grep not at head)   `rg` / `fd`   (different binaries)
#   `npm run find:x`, paths like `myfindfile`, quoted `"find the bug"` strings.
if print -r -- "$command_str" | grep -qE '(^|[|;&])[[:space:]]*(grep|egrep|fgrep|find)[[:space:]]'; then
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  sid="$(printf '%s' "$input" | jq -r '.session_id // ""')"
  cwd="$(printf '%s' "$input" | jq -r '.cwd // ""')"
  ledger="${HOME}/.claude/hook-nudges.jsonl"
  jq -nc --arg ts "$ts" --arg sid "$sid" --arg cwd "$cwd" --arg cmd "$command_str" \
    '{ts:$ts, hook:"nudge-search-tools", session:$sid, cwd:$cwd, command:$cmd}' \
    >> "$ledger" 2>/dev/null

  jq -nc '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext: ("Tooling default (CLAUDE.md): this command uses grep/find. "
        + "Prefer rg (ripgrep) for content search and fd for file search; for a window "
        + "around a match use the find-within skill. Note: rg/fd skip .gitignore by "
        + "default — add `rg -u` / `fd -I` to reach tmp/, build output, .env. Letting "
        + "this call proceed; use rg/fd on the next one.")
    }
  }'
  exit 0
fi

exit 0
