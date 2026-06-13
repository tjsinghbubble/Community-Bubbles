#!/usr/bin/env python3
"""testplan — drive the test-expansion backlog without collisions.

Companion to scripts/gen_test_backlog.py and tests/plan/. The backlog
(tests/plan/backlog.tsv) is the complete enumeration of assignment units. This tool hands
units to agents one at a time and tracks their state, so many short agent sessions (even
parallel ones) never grab the same unit or stomp each other's output.

Collision model: a unit is "claimed" by the EXISTENCE of its prompt file
tests/plan/units/<id>.md. Claiming creates that file with O_EXCL (atomic) — two agents
racing on the same unit, exactly one wins; the loser moves to the next candidate. The
output path was reserved in the backlog up front, so two units can never target one file.

Commands:
  status                 counts by area/status + units currently in progress
  list   [--status S] [--area A] [--kind K] [--layer L]
  next   [--area A] [--kind K] [--layer L]   claim the highest-priority todo unit
  claim  <unit_id>                           claim a specific unit
  show   <unit_id>                           print the prompt (or the backlog row)
  done   <unit_id>                           mark a claimed unit finished
  block  <unit_id> [reason...]               mark blocked (e.g. on a mock)
  release <unit_id>                          un-claim (delete the prompt file)
  gen                                        regenerate backlog.tsv (runs the generator)

Stdlib only. Add --json to status/list/next/claim/show for machine-readable output.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from string import Template

REPO = Path(__file__).resolve().parent.parent
PLAN = REPO / "tests" / "plan"
BACKLOG = PLAN / "backlog.tsv"
UNITS = PLAN / "units"
TEMPLATE = PLAN / "PROMPT_TEMPLATE.md"

POS_INSTR = (
    "Write the **positive / blue-sky** path: the use case succeeds for the role(s) above "
    "and you assert the success (state changed, item visible, 200 OK). ONE clean path — "
    "do not pile on edge assertions."
)
NEG_INSTR = (
    "Write ONE **negative** path: a single thing goes wrong and the system correctly "
    "refuses (invalid input rejected with the right message, an unauthorized actor denied, "
    "a duplicate not duplicated, a required field blocking submit). Assert BOTH the refusal "
    "AND that no state changed."
)
WANDER_INSTR = (
    "Write a **wandering-path** flow following the step list in the matching "
    "`tests/plan/wander/<role>.md` doc. This is a tolerant traversal, NOT a strict "
    "correctness test: assertVisible on landmarks + a screenshot at each stop; tolerate "
    "empty lists and externally-backed screens (chat, storage). Tag `wander, slow` (NOT "
    "`smoke`). See tests/plan/wander/README.md."
)


def tag_block(row: dict) -> str:
    """The exact tag header for this unit, so the Writer copies it verbatim instead of
    deciding which tags apply (smoke/unverified/role are removed as judgment calls).
    `unverified` is always included — the Reviewer drops it after one green run."""
    area, layer, kind, roles = row["area"], row["layer"], row["kind"], row["roles"]
    tags = [area]
    if kind == "wander":
        tags.append("slow")
    elif row.get("priority", "") == "1":  # priority "1 - Smoke" in the source TSV
        tags.append("smoke")
    tags.append(layer)
    if layer == "e2e":
        tags.append("ios")
    tags.append(roles)
    if "security" in row.get("tags", "").split(","):
        tags.append("security")
    tags.append("unverified")
    reason = f"<one line: what this {kind} test proves (UC {row['uc']})>"
    if layer == "e2e":
        listed = "\n".join(f"  - {t}" for t in tags)
        return (f"# qa-id: {row['unit_id']}\n# qa-reason: {reason}\n"
                f"# (in the flow header, alongside appId:)\ntags:\n{listed}")
    return (f"// qa-id: {row['unit_id']}\n"
            f"// qa-tags: {', '.join(tags)}\n"
            f"// qa-reason: {reason}")


def load_backlog() -> list[dict]:
    rows: list[dict] = []
    if not BACKLOG.exists():
        sys.exit(f"no backlog at {BACKLOG} — run: python3 scripts/testplan.py gen")
    lines = BACKLOG.read_text(encoding="utf-8").splitlines()
    header = lines[0].split("\t")
    for line in lines[1:]:
        if line.strip():
            rows.append(dict(zip(header, line.split("\t"))))
    return rows


def unit_file(uid: str) -> Path:
    return UNITS / f"{uid}.md"


def file_status(uid: str) -> str | None:
    """Status from a claimed unit's frontmatter, or None if not claimed."""
    p = unit_file(uid)
    if not p.exists():
        return None
    for ln in p.read_text(encoding="utf-8").splitlines():
        if ln.startswith("status:"):
            return ln.split(":", 1)[1].strip()
    return "claimed"


def effective_status(row: dict) -> str:
    """File state (in-progress work) wins over the backlog's static status."""
    fs = file_status(row["unit_id"])
    return fs if fs else row["status"]


def prio_key(row: dict) -> tuple:
    p = row.get("priority", "")
    try:
        n = int(p)
    except ValueError:
        n = 99
    return (n, row["unit_id"])


def render_prompt(row: dict) -> str:
    tmpl = Template(TEMPLATE.read_text(encoding="utf-8"))
    mock = row.get("needs_mock", "")
    mock_line = (
        f"**Blocked-on-mock:** this unit needs `{mock}` (see docs/Testing_Mocks.md). If the "
        "mock does not exist yet, do NOT fake it — write the test against the intended API, "
        "tag it `unverified`, and say so in your handback."
        if mock else "No mock required."
    )
    return tmpl.safe_substitute(
        unit_id=row["unit_id"], area=row["area"], kind=row["kind"], uc=row["uc"],
        uc_summary=row["uc_summary"], layer=row["layer"], roles=row["roles"],
        output_path=row["output_path"], needs_mock=mock or "none",
        claimed_at=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        kind_instructions={"pos": POS_INSTR, "neg": NEG_INSTR, "wander": WANDER_INSTR}.get(
            row["kind"], POS_INSTR),
        mock_line=mock_line,
        tag_block=tag_block(row),
    )


def materialize(row: dict) -> Path | None:
    """Atomic claim: create the prompt file with O_EXCL. None if already claimed."""
    UNITS.mkdir(parents=True, exist_ok=True)
    p = unit_file(row["unit_id"])
    try:
        with open(p, "x", encoding="utf-8") as fh:
            fh.write(render_prompt(row))
        return p
    except FileExistsError:
        return None


def set_status(uid: str, status: str, note: str = "") -> None:
    row = next((r for r in load_backlog() if r["unit_id"] == uid), None)
    if not row:
        sys.exit(f"unknown unit_id: {uid}")
    p = unit_file(uid)
    if not p.exists():
        materialize(row)  # auto-claim so done/block always has a file to stamp
    text = p.read_text(encoding="utf-8")
    out, replaced = [], False
    for ln in text.splitlines():
        if ln.startswith("status:") and not replaced:
            out.append(f"status: {status}")
            replaced = True
        else:
            out.append(ln)
    if note:
        out.append(f"\n> testplan {status} {datetime.now(timezone.utc):%Y-%m-%d}: {note}")
    p.write_text("\n".join(out) + "\n", encoding="utf-8")


# ---- commands ---------------------------------------------------------------

def cmd_status(args) -> int:
    rows = load_backlog()
    by_area: dict[str, dict[str, int]] = {}
    inprog = []
    for r in rows:
        st = effective_status(r)
        by_area.setdefault(r["area"], {}).setdefault(st, 0)
        by_area[r["area"]][st] += 1
        if st in ("claimed", "drafted"):
            inprog.append(r["unit_id"])
    if args.json:
        print(json.dumps({"by_area": by_area, "in_progress": inprog}, indent=2))
        return 0
    print(f"{'area':<14} todo block done claim review")
    tot = {"todo": 0, "blocked": 0, "done": 0, "claimed": 0, "review": 0}
    for area in sorted(by_area):
        c = by_area[area]
        for k in tot:
            tot[k] += c.get(k, 0)
        print(f"{area:<14} {c.get('todo',0):>4} {c.get('blocked',0):>5} "
              f"{c.get('done',0):>4} {c.get('claimed',0):>5} {c.get('review',0):>6}")
    print(f"{'TOTAL':<14} {tot['todo']:>4} {tot['blocked']:>5} {tot['done']:>4} "
          f"{tot['claimed']:>5} {tot['review']:>6}")
    if inprog:
        print("\nin progress: " + ", ".join(sorted(inprog)))
    return 0


def cmd_list(args) -> int:
    rows = load_backlog()
    sel = [r for r in rows
           if (not args.area or r["area"] == args.area)
           and (not args.kind or r["kind"] == args.kind)
           and (not args.layer or r["layer"] == args.layer)
           and (not args.status or effective_status(r) == args.status)]
    sel.sort(key=prio_key)
    if args.json:
        print(json.dumps(sel, indent=2))
        return 0
    for r in sel:
        print(f"{r['unit_id']:<22} {effective_status(r):<8} P{r['priority']:<3} "
              f"{r['layer']:<8} {r['kind']:<3} UC{r['uc']:<4} {r['uc_summary'][:54]}")
    print(f"\n{len(sel)} unit(s).")
    return 0


def _pick_next(args) -> dict | None:
    rows = [r for r in load_backlog()
            if (not args.area or r["area"] == args.area)
            and (not args.kind or r["kind"] == args.kind)
            and (not args.layer or r["layer"] == args.layer)
            and effective_status(r) == "todo"]
    rows.sort(key=prio_key)
    return rows[0] if rows else None


def cmd_next(args) -> int:
    while True:
        row = _pick_next(args)
        if not row:
            print("no todo units match.", file=sys.stderr)
            return 1
        p = materialize(row)
        if p:
            break  # won the claim
        # lost the race; loop picks the next candidate
    if args.json:
        print(json.dumps({"unit_id": row["unit_id"], "prompt": str(p.relative_to(REPO)),
                          "output_path": row["output_path"]}, indent=2))
    else:
        print(f"claimed {row['unit_id']} -> {p.relative_to(REPO)}")
        print(f"output: {row['output_path']}")
        print(f"hand this file to a test-writing agent; then: testplan.py done {row['unit_id']}")
    return 0


def cmd_claim(args) -> int:
    row = next((r for r in load_backlog() if r["unit_id"] == args.unit_id), None)
    if not row:
        sys.exit(f"unknown unit_id: {args.unit_id}")
    p = materialize(row)
    if not p:
        print(f"{args.unit_id} already claimed: {unit_file(args.unit_id).relative_to(REPO)}")
        return 1
    print(f"claimed {args.unit_id} -> {p.relative_to(REPO)}")
    return 0


def cmd_show(args) -> int:
    p = unit_file(args.unit_id)
    if p.exists():
        print(p.read_text(encoding="utf-8"))
        return 0
    row = next((r for r in load_backlog() if r["unit_id"] == args.unit_id), None)
    if not row:
        sys.exit(f"unknown unit_id: {args.unit_id}")
    print(json.dumps(row, indent=2) if args.json else
          "\n".join(f"{k}: {v}" for k, v in row.items()))
    print("\n(not yet claimed — `testplan.py claim` to materialize the prompt)")
    return 0


def cmd_done(args) -> int:
    set_status(args.unit_id, "done")
    print(f"{args.unit_id} -> done")
    return 0


def cmd_block(args) -> int:
    set_status(args.unit_id, "blocked", " ".join(args.reason))
    print(f"{args.unit_id} -> blocked")
    return 0


def cmd_release(args) -> int:
    p = unit_file(args.unit_id)
    if p.exists():
        p.unlink()
        print(f"released {args.unit_id}")
        return 0
    print(f"{args.unit_id} not claimed.")
    return 1


def cmd_gen(_args) -> int:
    return subprocess.call([sys.executable, str(REPO / "scripts" / "gen_test_backlog.py")])


def main() -> int:
    ap = argparse.ArgumentParser(prog="testplan", description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("status"); s.add_argument("--json", action="store_true"); s.set_defaults(fn=cmd_status)
    l = sub.add_parser("list")
    for f in ("status", "area", "kind", "layer"):
        l.add_argument(f"--{f}")
    l.add_argument("--json", action="store_true"); l.set_defaults(fn=cmd_list)
    n = sub.add_parser("next")
    for f in ("area", "kind", "layer"):
        n.add_argument(f"--{f}")
    n.add_argument("--json", action="store_true"); n.set_defaults(fn=cmd_next)
    c = sub.add_parser("claim"); c.add_argument("unit_id"); c.set_defaults(fn=cmd_claim)
    sh = sub.add_parser("show"); sh.add_argument("unit_id"); sh.add_argument("--json", action="store_true"); sh.set_defaults(fn=cmd_show)
    d = sub.add_parser("done"); d.add_argument("unit_id"); d.set_defaults(fn=cmd_done)
    b = sub.add_parser("block"); b.add_argument("unit_id"); b.add_argument("reason", nargs="*"); b.set_defaults(fn=cmd_block)
    r = sub.add_parser("release"); r.add_argument("unit_id"); r.set_defaults(fn=cmd_release)
    g = sub.add_parser("gen"); g.set_defaults(fn=cmd_gen)

    args = ap.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    raise SystemExit(main())
