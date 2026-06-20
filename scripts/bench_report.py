#!/usr/bin/env python3
"""bench_report.py — summarize a bench_sims.zsh run dir into matrices.

Reads the per-invocation qa-<sim>-r<round>-<layer>.out files (each names its
tests/output/run-*/ dir → summary.json) and warmup-<sim>-r<round>.out boot timings, then
prints: boot times, an e2e + a headless matrix (result counts + duration + per-test speed),
and a count-change analysis (by round, by sim variant). Read-only; safe to re-run.

Usage: python3 scripts/bench_report.py [tmp/bench-<STAMP>]   (default: newest tmp/bench-*)
"""
import re, json, glob, os, sys, sqlite3
from datetime import datetime

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(REPO, ".device-manager", "devices.db")
RUN_RE = re.compile(r'tests/output/run-\d{8}t\d{6}Z-[0-9a-f]+')


def level_of(sim):
    """compile_level for a sim alias, from the device-manager DB ('?' if unknown)."""
    try:
        con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True, timeout=2)
        row = con.execute(
            "SELECT d.compile_level FROM aliases a JOIN devices d ON d.udid=a.udid "
            "WHERE a.alias=?", (sim,)).fetchone()
        con.close()
        return (row[0] if row and row[0] else "none")
    except Exception:
        return "?"


def parse_iso(s):
    try:
        return datetime.fromisoformat((s or "").replace("Z", "+00:00"))
    except ValueError:
        return None


def load(bench_dir):
    rows = []
    for f in sorted(glob.glob(os.path.join(bench_dir, "qa-*-r*-*.out"))):
        m = re.match(r'qa-(\w+)-r(\d+)-(\w+)\.out$', os.path.basename(f))
        if not m:
            continue
        sim, rnd, layer = m.group(1), int(m.group(2)), m.group(3)
        dirs = RUN_RE.findall(open(f, errors="replace").read())
        rec = {"sim": sim, "lvl": level_of(sim), "round": rnd, "layer": layer,
               "total": None, "passed": None, "failed": None, "find": None, "dur": None}
        sm = os.path.join(REPO, dirs[-1], "summary.json") if dirs else None
        if sm and os.path.exists(sm):
            s = json.load(open(sm)); meta = s.get("meta", s); t = meta.get("totals", {})
            st, fin = parse_iso(meta.get("startedAt")), parse_iso(meta.get("finishedAt"))
            rec.update(total=t.get("total"), passed=t.get("passed"), failed=t.get("failed"),
                       find=t.get("findings"), kb=t.get("knownBugs"),
                       dur=round((fin - st).total_seconds()) if st and fin else None)
        rows.append(rec)
    boots = {}
    for f in glob.glob(os.path.join(bench_dir, "warmup-*-r*.out")):
        m = re.match(r'warmup-(\w+)-r(\d+)\.out$', os.path.basename(f))
        if not m:
            continue
        t = re.findall(r'ready in (\d+)s', open(f, errors="replace").read())
        boots[(m.group(1), int(m.group(2)))] = int(t[-1]) if t else None
    return rows, boots


def matrix(rows, layer, boots=None):
    sub = [r for r in rows if r["layer"] == layer]
    if not sub:
        return
    print(f"\n── {layer} ──  (Tests=collected, Find=expected-findings/unverified)")
    hdr = f"  {'Sim':9}{'Lvl':8}{'Rnd':4}{'Boot':6}{'Tests':6}{'Pass':6}{'Fail':6}{'Find':6}{'Dur(s)':8}{'s/test':7}"
    print(hdr); print("  " + "-" * (len(hdr) - 2))
    for r in sorted(sub, key=lambda r: (r["lvl"], r["sim"], r["round"])):
        boot = (boots or {}).get((r["sim"], r["round"]))
        tot, dur = r["total"], r["dur"]
        spt = f"{dur / tot:.1f}" if (tot and dur) else ""
        print(f"  {r['sim']:9}{r['lvl']:8}{r['round']:<4}{(str(boot)+'s' if boot is not None else '?'):6}"
              f"{str(tot if tot is not None else '—'):6}{str(r['passed'] if r['passed'] is not None else '—'):6}"
              f"{str(r['failed'] if r['failed'] is not None else '—'):6}{str(r['find'] if r['find'] is not None else '—'):6}"
              f"{str(dur if dur is not None else '—'):8}{spt:7}")


def count_changes(rows):
    print("\n── test-count changes ──")
    # by round: same (sim,layer) across rounds
    by_sl = {}
    for r in rows:
        by_sl.setdefault((r["sim"], r["layer"]), {})[r["round"]] = r["total"]
    round_diffs = {k: v for k, v in by_sl.items() if len(set(v.values())) > 1}
    print("  by round : " + ("none — every sim's Tests count is identical across rounds"
          if not round_diffs else "; ".join(f"{s} {l}: {v}" for (s, l), v in round_diffs.items())))
    # by sim variant: within a layer, do totals differ across sims?
    for layer in sorted({r["layer"] for r in rows}):
        totals = {r["sim"]: r["total"] for r in rows if r["layer"] == layer}
        uniq = set(totals.values())
        if len(uniq) > 1:
            odd = [f"{s}={t}" for s, t in totals.items()]
            print(f"  by sim ({layer}): DIFFERS → {', '.join(sorted(set(odd)))}")
        else:
            print(f"  by sim ({layer}): same ({uniq.pop()}) for all variants")


def main():
    bench_dir = sys.argv[1] if len(sys.argv) > 1 else None
    if not bench_dir:
        cands = sorted(glob.glob(os.path.join(REPO, "tmp", "bench-*")), reverse=True)
        bench_dir = cands[0] if cands else None
    if not bench_dir or not os.path.isdir(bench_dir):
        print("no bench dir found (tmp/bench-*)"); return 2
    print(f"bench: {bench_dir}")
    rows, boots = load(bench_dir)
    matrix(rows, "e2e", boots)
    matrix(rows, "headless", boots)
    count_changes(rows)
    return 0


if __name__ == "__main__":
    sys.exit(main())
