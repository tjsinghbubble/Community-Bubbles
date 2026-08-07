#!/usr/bin/env zsh
# analyze_bench_run.zsh — full analysis of a bench_sims.zsh output dir.
#
# Consolidates every query used to dissect the overnight compile-level run:
#   1. raw per-(sim,round,layer) summary table, with run-dir provenance
#   2. boot (warmup) times per sim/round
#   3. the matrix + count-change analysis (scripts/bench_report.py)
#   4. diagnostics for any run that collected 0 tests / never executed
#
# Each qa-<sim>-r<round>-<layer>.out names its tests/output/run-*/ dir → summary.json;
# warmup-<sim>-r<round>.out carries the "ready in Ns" boot timing. Read-only; re-runnable.
#
# Usage: zsh scripts/analyze_bench_run.zsh [tmp/bench-<STAMP>]   (default: newest tmp/bench-*)

set -u
cd ${0:A:h}/..                                  # repo root

BD=${1:-$(ls -dt tmp/bench-*(/N) 2>/dev/null | head -1)}
[[ -n $BD && -d $BD ]] || { print -u2 "no bench dir (tmp/bench-*) — pass one as \$1"; exit 1 }
print "bench dir: $BD"

RUN_RE='tests/output/run-[0-9]{8}t[0-9]{6}Z-[0-9a-f]+'

print "\n========== 1. raw per-run summary (with run-dir provenance) =========="
python3 - "$BD" <<'PY'
import re, json, glob, os, sys
from datetime import datetime
BD = sys.argv[1]
RUN_RE = re.compile(r'tests/output/run-\d{8}t\d{6}Z-[0-9a-f]+')
def piso(s):
    try: return datetime.fromisoformat((s or "").replace("Z", "+00:00"))
    except ValueError: return None
print(f"{'sim':9}{'rnd':4}{'layer':9}{'tot':5}{'pass':5}{'fail':5}{'kb':4}{'fnd':4}{'dur_s':7}  run")
for f in sorted(glob.glob(f"{BD}/qa-*-r*-*.out")):
    m = re.match(r'qa-(\w+)-r(\d+)-(\w+)\.out$', os.path.basename(f))
    if not m: continue
    sim, rnd, layer = m.group(1), m.group(2), m.group(3)
    dirs = RUN_RE.findall(open(f, errors="replace").read()); rd = dirs[-1] if dirs else None
    tot = p = fa = kb = fn = dur = ""
    if rd and os.path.exists(f"{rd}/summary.json"):
        s = json.load(open(f"{rd}/summary.json")); meta = s.get("meta", s); t = meta.get("totals", {})
        st, fi = piso(meta.get("startedAt")), piso(meta.get("finishedAt"))
        tot, p, fa = t.get("total", ""), t.get("passed", ""), t.get("failed", "")
        kb, fn = t.get("knownBugs", ""), t.get("findings", "")
        dur = round((fi - st).total_seconds()) if st and fi else ""
    print(f"{sim:9}{rnd:<4}{layer:9}{str(tot):5}{str(p):5}{str(fa):5}{str(kb):4}{str(fn):4}"
          f"{str(dur):7}  {os.path.basename(rd) if rd else 'NO-RUN-DIR'}")
PY

print "\n========== 2. boot (warmup) times per sim/round =========="
for f in $BD/warmup-*-r*.out(N); do
  base=${${f:t}:r}
  t=$(grep -oE 'ready in [0-9]+s' $f | grep -oE '[0-9]+' | tail -1)
  printf '  %-22s boot=%ss\n' $base ${t:-?}
done

print "\n========== 3. matrix + count-change analysis (bench_report.py) =========="
python3 scripts/bench_report.py $BD

print "\n========== 4. diagnostics: runs that collected 0 tests =========="
any=0
for f in $BD/qa-*-r*-*.out(N); do
  rd=$(grep -oE $RUN_RE $f | tail -1)
  tot=""
  [[ -n $rd && -f $rd/summary.json ]] && \
    tot=$(python3 -c "import json;print(json.load(open('$rd/summary.json')).get('meta',{}).get('totals',{}).get('total',''))" 2>/dev/null)
  if [[ -z $rd || $tot == 0 ]]; then
    any=1
    print "  ⚠️  ${f:t}: total=${tot:-NONE} — last signals:"
    grep -iE 'waiting for|gate|fail|no tests|abort|error|timed out|emulator' $f | tail -5 | sed 's/^/      /'
  fi
done
if [[ $any == 0 ]]; then print "  (none — every run collected tests)"; fi
exit 0
