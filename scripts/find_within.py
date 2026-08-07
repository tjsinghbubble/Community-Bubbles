#!/usr/bin/env python3
"""find-within — read a targeted WINDOW of a file by pattern, instead of grep|cut|xargs|sed.

Three jobs this session did over and over with throwaway pipelines:
  1. "PATTERN exists somewhere in FILE — show me it (and N lines around it)."
  2. "show a trailing/preceding window from PATTERN" (-A / -B / -C, like grep).
  3. "region runs from pattern A to pattern B, I don't know where either is" (--between).

One call, line-numbered output, so an agent reads exactly the slice it needs and nothing
more (fewer tokens, fewer permission prompts than a multi-stage pipeline).

Examples:
  find_within.py "async getEffectiveRules" server/storage.ts -A 40
  find_within.py "app.post\\(\"/api/rules/app" server/routes.ts -A 12 --first
  find_within.py --between "app.get\\(\"/api/admin/stats" "res.json\\(" server/routes.ts
  find_within.py "test=test\\(" tmp/qa-server-*.log --last        # last match (logs)
  find_within.py "ERROR" app.log --count                          # just the count

Notes: PATTERN is a Python regex (use -F for a literal). Multiple PATHs / globs allowed.
Stdlib only.
"""
from __future__ import annotations

import argparse
import re
import sys
from glob import glob


def expand(paths: list[str]) -> list[str]:
    out: list[str] = []
    for p in paths:
        hits = sorted(glob(p))
        out.extend(hits if hits else [p])
    return out


def emit(path: str, lines: list[str], lo: int, hi: int, show_path: bool) -> None:
    width = len(str(hi + 1))
    for i in range(lo, hi + 1):
        prefix = f"{path}:" if show_path else ""
        print(f"{prefix}{str(i + 1).rjust(width)}  {lines[i].rstrip(chr(10))}")


def main() -> int:
    ap = argparse.ArgumentParser(prog="find-within", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pattern", help="regex (or literal with -F). In --between mode this is pattern A.")
    ap.add_argument("paths", nargs="+", help="file(s) or glob(s); in --between mode the last arg is the file/glob")
    ap.add_argument("--between", metavar="ENDPAT",
                    help="region mode: print from each match of PATTERN (start) to the next match of ENDPAT (end), inclusive")
    ap.add_argument("-A", type=int, default=0, help="lines of trailing context")
    ap.add_argument("-B", type=int, default=0, help="lines of leading context")
    ap.add_argument("-C", type=int, default=0, help="lines of context on both sides")
    ap.add_argument("-i", action="store_true", help="case-insensitive")
    ap.add_argument("-F", action="store_true", help="treat patterns as literal strings, not regex")
    ap.add_argument("--first", action="store_true", help="only the first match/region")
    ap.add_argument("--last", action="store_true", help="only the last match (single-pattern mode)")
    ap.add_argument("--count", action="store_true", help="print only the number of matches")
    ap.add_argument("--max", type=int, default=0, help="cap regions/windows printed (0 = no cap)")
    args = ap.parse_args()

    flags = re.IGNORECASE if args.i else 0
    mk = (lambda s: re.compile(re.escape(s), flags)) if args.F else (lambda s: re.compile(s, flags))
    try:
        start_re = mk(args.pattern)
        end_re = mk(args.between) if args.between else None
    except re.error as e:
        return _err(f"bad regex: {e}")

    # In --between mode the file glob is the trailing positional(s); in normal mode all paths are files.
    files = expand(args.paths)
    if not files:
        return _err("no files matched")

    a = args.C or args.A
    b = args.C or args.B
    total = 0
    printed = 0
    multi = len(files) > 1

    for path in files:
        try:
            with open(path, encoding="utf-8", errors="replace") as fh:
                lines = fh.readlines()
        except (OSError, IsADirectoryError) as e:
            _err(f"{path}: {e}", fatal=False)
            continue

        idxs = [i for i, ln in enumerate(lines) if start_re.search(ln)]
        total += len(idxs)
        if args.count:
            continue

        if end_re is not None:  # region mode: A-match -> next B-match
            i = 0
            while i < len(lines):
                if start_re.search(lines[i]):
                    j = next((k for k in range(i, len(lines)) if end_re.search(lines[k])), None)
                    if j is not None:
                        if printed and not multi:
                            print("--")
                        emit(path, lines, max(0, i - b), min(len(lines) - 1, j + a), multi)
                        printed += 1
                        if args.first or (args.max and printed >= args.max):
                            break
                        i = j + 1
                        continue
                i += 1
        else:  # window mode
            sel = idxs[:1] if args.first else (idxs[-1:] if args.last else idxs)
            for i in sel:
                if printed and not multi:
                    print("--")
                emit(path, lines, max(0, i - b), min(len(lines) - 1, i + a), multi)
                printed += 1
                if args.max and printed >= args.max:
                    break

    if args.count:
        print(total)
        return 0
    return 0 if printed else 1  # exit 1 = no matches (greppable)


def _err(msg: str, fatal: bool = True) -> int:
    print(f"find-within: {msg}", file=sys.stderr)
    if fatal:
        sys.exit(2)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
