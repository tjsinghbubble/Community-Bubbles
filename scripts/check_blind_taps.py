#!/usr/bin/env python3
"""
check_blind_taps — fail if any Maestro flow uses a BLIND tap: a coordinate or
percentage locator (`point:`, or a `tapOn`/`longPressOn`/`doubleTapOn` given a
bare "x,y" string) instead of a real selector (id/text/...).

Why this is a standing check: a blind tap is device-size-fragile. `point: 53%,
41%` calibrated for a 390x844 screen mis-taps on an iPhone 17 and derails the
flow (proven on events-0500). A pixel guess is a process smell — the element
wants a stable testID/selector, not a coordinate.

Ratchet policy: a blind tap is allowed ONLY if justified inline with a
`# blind-tap-ok: <reason>` comment on the SAME line or the line directly above.
Un-annotated blind taps fail (exit 1). Existing debt is annotated + tracked;
new blind taps are blocked.

Scans tests/e2e/**/*.yaml (override roots via argv). stdlib only.
"""
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ROOTS = [REPO_ROOT / "tests" / "e2e"]

OK_MARKER = "blind-tap-ok"

# A `point:`, `start:`, or `end:` key whose value is a coordinate pair (x,y or x%,y%) is a
# blind locator. `start:`/`end:` are the coordinate forms of `swipe:` — a swipe driven by
# raw coordinates is the same device-size-fragile debt as a coordinate tap.
POINT_KEY = re.compile(
    r"^\s*(?:point|start|end)\s*:\s*['\"]?"
    r"\d+(?:\.\d+)?%?\s*,\s*\d+(?:\.\d+)?%?",
    re.IGNORECASE,
)
# An inline coordinate tap: `tapOn: "50%, 50%"`, `tapOn: 100, 200`, longPressOn, …
INLINE_COORD = re.compile(
    r"^\s*(?:tapOn|longPressOn|doubleTapOn)\s*:\s*['\"]?"
    r"\d+(?:\.\d+)?%?\s*,\s*\d+(?:\.\d+)?%?",
    re.IGNORECASE,
)


_OWNER = re.compile(r"^-?\s*(?:tapOn|longPressOn|doubleTapOn|swipe|commands)\s*:",
                    re.IGNORECASE)
# Non-coordinate sibling props of a swipe block, stepped over when locating its annotation.
_SWIPE_PROP = re.compile(r"^-?\s*(?:duration|direction)\s*:", re.IGNORECASE)


def _annotated(lines, idx):
    """True if the `# blind-tap-ok:` marker is on line idx or in the comment block
    documenting this tap. Walk upward over blanks, comments, and the owning command
    header (`- tapOn:` etc. — the `point:` is nested under it); stop at any other
    content so a marker can't leak in from an unrelated earlier step."""
    if OK_MARKER in lines[idx]:
        return True
    j = idx - 1
    while j >= 0:
        s = lines[j].strip()
        if not s:
            j -= 1
        elif OK_MARKER in s:
            return True
        # Step over blanks, comments, the owning command header (tapOn/swipe/…), and the
        # block's sibling property lines (start/end/point coords, duration, direction) so a
        # `# blind-tap-ok` above a multi-line swipe covers all of its coordinate lines.
        elif (s.startswith("#") or _OWNER.match(s) or POINT_KEY.match(s)
              or _SWIPE_PROP.match(s)):
            j -= 1
        else:
            break
    return False


def scan_file(path):
    """Return (violations, allowed) as lists of (lineno, text)."""
    violations, allowed = [], []
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    for i, line in enumerate(lines):
        if POINT_KEY.match(line) or INLINE_COORD.match(line):
            entry = (i + 1, line.strip())
            (allowed if _annotated(lines, i) else violations).append(entry)
    return violations, allowed


def main(argv=None):
    argv = argv if argv is not None else sys.argv[1:]
    roots = [Path(a) for a in argv] if argv else DEFAULT_ROOTS
    files = sorted({p for root in roots for p in root.rglob("*.yaml")})

    total_v, total_a = 0, 0
    for f in files:
        violations, allowed = scan_file(f)
        rel = f.relative_to(REPO_ROOT) if f.is_relative_to(REPO_ROOT) else f
        for lineno, text in allowed:
            total_a += 1
            print(f"  allowed  {rel}:{lineno}: {text}")
        for lineno, text in violations:
            total_v += 1
            print(f"✘ BLIND TAP {rel}:{lineno}: {text}")

    print(f"\nScanned {len(files)} flow(s): "
          f"{total_v} un-annotated blind tap(s), {total_a} annotated (tracked).")
    if total_v:
        print("\nBlind (coordinate/percentage) taps are device-size-fragile. Use a "
              "testID/text selector. If a coordinate is genuinely unavoidable, add a "
              "`# blind-tap-ok: <reason>` comment on or above the line to acknowledge "
              "the debt.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
