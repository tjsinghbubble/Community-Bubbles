#!/usr/bin/env python3
"""
check_brittle_selectors — flag Maestro flows that target elements by brittle, position-
or text-based locators instead of stable testID/accessibility ids. Two severities:

ERROR (fails the gate unless annotated) — inarguably brittle; a different form factor or
a text-length change can break them:
  - coordinate    `point:`, an inline `tapOn: "x,y"`, or `swipe:` start/end coords
                  (relative OR absolute pixels/percentages).
  - relative      above / below / leftOf / rightOf — may hold in one form factor, not another.
  - css           web-only; never valid for native flows.
  - traits        not acceptable outside a throwaway POC.

RISKY (warns; does not fail the build) — sometimes legitimate, but easy to mis-target:
  - text          a regex match, may hit the wrong element. OK for a stable label / tab / FAB.
  - index         only reliable for a FAB, or immediately after an insert/delete.
  (Only flagged when used to LOCATE — i.e. under tapOn / longPressOn / doubleTapOn. `text:`
  under assertVisible / extendedWaitUntil is asserting presence, not locating, so it's left.)

OK (never flagged) — accessibility-tree relative, or assertion-only attributes:
  childOf, containsChild, containsDescendants; enabled / checked / selected / focused.

Ratchet: a finding is suppressed by a `# brittle-ok: <reason>` comment (alias:
`# blind-tap-ok:`) on the same line or in the comment block directly above the step.
ERROR findings fail (exit 1); RISKY findings only warn. Existing debt gets annotated and
tracked; new brittle selectors are blocked (errors) or surfaced (risky).

Scans tests/e2e/**/*.yaml (override roots via argv). stdlib only.
"""
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ROOTS = [REPO_ROOT / "tests" / "e2e"]

OK_MARKERS = ("brittle-ok", "blind-tap-ok")  # blind-tap-ok kept as a back-compat alias

_COORD = r"\d+(?:\.\d+)?%?\s*,\s*\d+(?:\.\d+)?%?"

# ── ERROR-severity line patterns ────────────────────────────────────────────────
# point:/start:/end: with a coordinate value (start/end are swipe's coordinate form).
COORD_KEY = re.compile(rf"^\s*(?:point|start|end)\s*:\s*['\"]?{_COORD}", re.IGNORECASE)
# inline coordinate tap: `tapOn: "50%, 50%"`, `tapOn: 100, 200`, longPress/doubleTap.
INLINE_COORD = re.compile(
    rf"^\s*(?:tapOn|longPressOn|doubleTapOn)\s*:\s*['\"]?{_COORD}", re.IGNORECASE)
RELATIVE_KEY = re.compile(r"^\s*-?\s*(?:above|below|leftOf|rightOf)\s*:", re.IGNORECASE)
CSS_KEY = re.compile(r"^\s*-?\s*css\s*:", re.IGNORECASE)
TRAITS_KEY = re.compile(r"^\s*-?\s*traits\s*:", re.IGNORECASE)

ERROR_PATTERNS = [
    ("coordinate", COORD_KEY), ("coordinate", INLINE_COORD),
    ("relative", RELATIVE_KEY), ("css", CSS_KEY), ("traits", TRAITS_KEY),
]

# ── RISKY-severity locator keys (only when used to LOCATE) ───────────────────────
TEXT_KEY = re.compile(r"^\s*-?\s*text\s*:", re.IGNORECASE)
INDEX_KEY = re.compile(r"^\s*-?\s*index\s*:", re.IGNORECASE)
RISKY_PATTERNS = [("text", TEXT_KEY), ("index", INDEX_KEY)]
INTERACTION_CMDS = {"tapon", "longpresson", "doubletapon"}

_CMD = re.compile(r"-\s*([A-Za-z]\w*)\s*:")


def _indent(raw):
    return len(raw) - len(raw.lstrip())


def _owning_command(lines, idx):
    """Nearest enclosing `- <command>:` above line idx (stepping over intermediate
    keys like `visible:` by tightening the indent as we climb). Lowercased, or None."""
    indent = _indent(lines[idx])
    for j in range(idx - 1, -1, -1):
        s = lines[j].strip()
        if not s or s.startswith("#"):
            continue
        ind = _indent(lines[j])
        if ind < indent:
            m = _CMD.match(s)
            if m:
                return m.group(1).lower()
            indent = ind  # a shallower non-command key (e.g. `visible:`) — keep climbing
    return None


def _annotated(lines, idx):
    """True if a brittle-ok/blind-tap-ok marker is on this line or in the comment block
    documenting this step. Climb over blanks, comments, the owning command header, and a
    block's sibling property lines (coords / duration / direction) so one marker covers a
    whole multi-line step."""
    if any(m in lines[idx] for m in OK_MARKERS):
        return True
    j = idx - 1
    while j >= 0:
        s = lines[j].strip()
        if not s:
            j -= 1
        elif any(m in s for m in OK_MARKERS):
            return True
        elif (s.startswith("#") or _OWNER.match(s) or COORD_KEY.match(s)
              or _SWIPE_PROP.match(s)):
            j -= 1
        else:
            break
    return False


_OWNER = re.compile(
    r"^-?\s*(?:tapOn|longPressOn|doubleTapOn|swipe|commands)\s*:", re.IGNORECASE)
_SWIPE_PROP = re.compile(r"^-?\s*(?:duration|direction)\s*:", re.IGNORECASE)


def scan_file(path):
    """Return (errors, risky, allowed): each a list of (lineno, kind, text)."""
    errors, risky, allowed = [], [], []
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    for i, line in enumerate(lines):
        kind = next((k for k, rx in ERROR_PATTERNS if rx.match(line)), None)
        sev = "error"
        if not kind:
            rk = next((k for k, rx in RISKY_PATTERNS if rx.match(line)), None)
            # text/index only count as brittle when used to LOCATE (under an interaction).
            if rk and _owning_command(lines, i) in INTERACTION_CMDS:
                kind, sev = rk, "risky"
        if not kind:
            continue
        entry = (i + 1, kind, line.strip())
        if _annotated(lines, i):
            allowed.append(entry)
        elif sev == "error":
            errors.append(entry)
        else:
            risky.append(entry)
    return errors, risky, allowed


def main(argv=None):
    argv = argv if argv is not None else sys.argv[1:]
    roots = [Path(a) for a in argv] if argv else DEFAULT_ROOTS
    files = sorted({p for root in roots for p in root.rglob("*.yaml")})

    n_err = n_risk = n_ok = 0
    for f in files:
        errors, risky, allowed = scan_file(f)
        rel = f.relative_to(REPO_ROOT) if f.is_relative_to(REPO_ROOT) else f
        for lineno, kind, text in allowed:
            n_ok += 1
            print(f"  allowed  [{kind}] {rel}:{lineno}: {text}")
        for lineno, kind, text in risky:
            n_risk += 1
            print(f"⚠ RISKY  [{kind}] {rel}:{lineno}: {text}")
        for lineno, kind, text in errors:
            n_err += 1
            print(f"✘ ERROR  [{kind}] {rel}:{lineno}: {text}")

    print(f"\nScanned {len(files)} flow(s): {n_err} error(s), {n_risk} risky (warn), "
          f"{n_ok} annotated (tracked).")
    if n_err:
        print("\nERROR selectors (coordinate/relative/css/traits) are device-fragile — use a "
              "testID/accessibility id. If genuinely unavoidable, add `# brittle-ok: <reason>`.")
    if n_risk:
        print("RISKY selectors (text/index used to locate) can mis-target — prefer an id, or "
              "add `# brittle-ok: <reason>` to acknowledge.")
    return 1 if n_err else 0


if __name__ == "__main__":
    sys.exit(main())
