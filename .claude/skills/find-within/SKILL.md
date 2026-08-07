---
name: find-within
description: Read a targeted window or region of a file by pattern, instead of a grep|cut|xargs|sed pipeline. Use when you need the lines around a match, a trailing/leading window from a pattern, the span between two patterns (function body, handler block), the count of matches, or the last match in a log — and you don't know the line numbers. Reads exactly the slice needed (fewer tokens, one permission prompt).
---

# find-within

`python3 scripts/find_within.py` — one call replaces the recurring
`grep -n PAT f | cut -d: -f1 | xargs sed -n 'N,+Mp'` dance. Output is line-numbered.
PATTERN is a Python regex (use `-F` for literal). Globs/multiple files allowed.
Exit 1 if no match (greppable). Prefer this over Read when you only need a slice of a big file.

## Modes

```bash
# window around a match (grep-style context)
python3 scripts/find_within.py "async getEffectiveRules" server/storage.ts -A 40
python3 scripts/find_within.py "input-password" docs/maestro_testids.md -C 2

# only the first / only the last match
python3 scripts/find_within.py 'app\.post\("/api/rules/app' server/routes.ts -A 12 --first
python3 scripts/find_within.py 'test=test\(' tmp/qa-server-*.log --last        # tail a log to its last hit

# region BETWEEN two patterns: START is positional, END is --between (inclusive)
python3 scripts/find_within.py 'app\.get\("/api/admin/stats' server/routes.ts --between 'res\.json'
#   -> prints the whole handler from its declaration to its res.json, wherever they are

# just the count
python3 scripts/find_within.py "ERROR" app.log --count
```

## When to reach for it
- "X is defined/used somewhere in this big file — show me it + context" → window mode.
- "show the body of this function/handler/case" → `--between START END` (e.g. signature → closing
  `}` or `res.json(`).
- "what does the server log say happened last / how many times" → `--last` / `--count` over the log.
- Confirming an API request/response **shape** before briefing a Writer subagent (paste the slice).

Flags: `-A`/`-B`/`-C` (after/before/context), `-i` (ignore case), `-F` (literal), `--first`,
`--last`, `--count`, `--max N` (cap windows). Gotcha: in `--between` mode the positional is the
START pattern and `--between` carries the END — don't swap them (a swap prints a giant region).
