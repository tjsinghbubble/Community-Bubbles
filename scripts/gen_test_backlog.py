#!/usr/bin/env python3
"""Generate the test-expansion backlog from docs/use-cases-and-tests.tsv.

Phase-1 of the test-expansion effort (see tests/plan/README.md). This script does NOT
write tests. It enumerates, for every known use case, the assignment units a cheap LLM
agent will later turn into test code:

  - one POSITIVE (blue-sky) unit per use case
  - one NEGATIVE unit per use case

It reserves a stable test-id for each new unit (the <area>-<NNNN> scheme from
tests/TAXONOMY.md), marks units already covered by an existing test as `done`, flags
units blocked on a missing mock (docs/Testing_Mocks.md), guesses a layer (e2e vs
headless) and the acting role(s), and writes a single diff-friendly ledger:

    tests/plan/backlog.tsv

The backlog is the COMPLETE breadth-first enumeration (the "what needs doing"). It is
the source of truth for collision avoidance: every unit already owns a unique id and a
unique output path, so two agents working in parallel can never collide on output.
Per-unit prompt files are materialised on demand by scripts/testplan.py (the claim is an
atomic create), not by this script.

Re-run any time docs/use-cases-and-tests.tsv changes. It is idempotent: it never edits
units/*.md and never overwrites a `status` you have advanced — it regenerates the
enumeration and leaves orchestration state to testplan.py (which reads units/*.md).

Usage:  python3 scripts/gen_test_backlog.py [--check]
        --check : exit non-zero if backlog.tsv would change (CI guard), write nothing.
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
TSV_IN = REPO / "docs" / "use-cases-and-tests.tsv"
OUT = REPO / "tests" / "plan" / "backlog.tsv"

# TSV column indices (see header row of docs/use-cases-and-tests.tsv).
C_AREA = 2
C_ROLES = 4
C_UC = 7        # "Orig Use Case Rank" == the UC number referenced elsewhere as "UC 182"
C_SUMMARY = 8
C_PRIORITY = 9
C_NEG_FLAG = 13
C_SEC = 15
C_TWO_ACCT = 16

# Functional Area (TSV) -> taxonomy area tag (tests/TAXONOMY.md).
AREA_MAP = {
    "Account & Onboarding": "auth",
    "Discovering Bubbles": "discovery",
    "Joining Bubbles": "joining",
    "Events": "events",
    "Bubble Admin": "bubble-admin",
    "Site Admin": "site-admin",
    "Communication": "comms",
    "Campus Mode": "campus",
    "Notifications": "notification",
    "Categories": "categories",
    "Waitlist & Reports": "reports",
    "Site Monitoring": "monitoring",
    "Rules": "rules",
}

ROLE_MAP = {
    "3 - Group Member": "role-user",
    "2 - Group Admin": "role-bubble-admin",
    "1 - Super Admin": "role-site-admin",
}

# Lowest free hundred-block per area, given the ids already used by existing tests
# (tests/TAXONOMY.md registry). New units consume blocks ascending from here.
NEXT_BLOCK = {
    "auth": 4, "discovery": 5, "joining": 7, "events": 9,
    "bubble-admin": 8, "site-admin": 2, "comms": 1, "campus": 1,
    "notification": 1, "categories": 1, "reports": 1, "monitoring": 1, "rules": 1,
}

# (uc_number, kind) -> (existing_test_id, status). Units already implemented (or reserved
# + blocked) per the TAXONOMY registry; these consume no new id.
COVERED: dict[tuple[int, str], tuple[str, str]] = {
    (182, "pos"): ("auth-0100", "done"),
    (182, "neg"): ("auth-0110", "done"),
    (180, "pos"): ("auth-0200", "done"),
    (180, "neg"): ("auth-0210", "done"),       # + auth-0220/0230 UI negatives
    (188, "pos"): ("auth-0300", "blocked"),    # blocked on email mock (Testing_Mocks §1)
    (204, "pos"): ("discovery-0300", "done"),
    (45, "pos"): ("discovery-0400", "done"),
    (212, "pos"): ("joining-0400", "done"),
    (44, "pos"): ("joining-0500", "done"),
    (44, "neg"): ("joining-0510", "done"),
    (215, "pos"): ("joining-0520", "done"),
    (213, "pos"): ("joining-0600", "done"),
    (160, "pos"): ("events-0500", "done"),
    (33, "pos"): ("events-0500", "done"),
    (47, "pos"): ("events-0600", "done"),
    (47, "neg"): ("events-0610", "done"),
    (225, "pos"): ("events-0600", "done"),
    (225, "neg"): ("events-0610", "done"),
    (162, "pos"): ("events-0700", "done"),
    (162, "neg"): ("events-0710", "done"),     # + events-0720 UI negative
    (163, "pos"): ("events-0800", "done"),
    (129, "pos"): ("bubble-admin-0600", "done"),
    (26, "pos"): ("bubble-admin-0700", "done"),
    (135, "pos"): ("site-admin-0100", "done"),
    (68, "pos"): ("site-admin-0100", "done"),
}

# Keyword -> mock id from docs/Testing_Mocks.md. First match wins.
MOCK_RULES = [
    (("reset", "change password", "forgot"), "mock1-email"),
    ((".edu", "verification code", "verify a university", "verification received"), "mock1-email"),
    ((" chat ", "message", "messaging", "conversation", "direct message", " dm "), "mock2-cometchat"),
    (("photo", "cover image", "image", "upload"), "mock3-media"),
    (("notification",), "mock5-push"),
    (("qr code", "share sheet", "native share", "short link", "copy the"), "mock6-share"),
]

# Areas that are pure API/admin/data per their area docs — always headless, regardless of
# verbs like "view" (which otherwise mis-tags an API read as a UI flow; see rules-0100).
# Per-unit exceptions (e.g. monitoring UC 106 auto-refresh) are flipped by the area doc +
# Writer judgment, not here.
HEADLESS_AREAS = {"rules", "categories", "monitoring", "reports"}

# Layer guess. e2e verbs win first (user-facing UI), then headless (admin/API CRUD).
E2E_KW = ("view", "browse", "see ", "scroll", "rsvp", "join", "sign ", "onboarding",
          "edit profile", "display name", "about me", "bio", "interests", "dismiss",
          "prompt", "badge", "share", "upload", "filter", "search")
HEADLESS_KW = ("approve", "reject", "manage", "delete any", "reorder", "category",
               "categories", "stats", "metrics", "health", "memory", "latency",
               "waitlist", "authz", "member limit", "remove", "export", "privacy setting",
               "notification preference", "app-wide rule", "platform")


def norm(s: str) -> str:
    return " " + s.lower().strip() + " "


def slug(s: str, words: int = 6) -> str:
    out, parts = [], s.lower().split()
    for w in parts[:words]:
        w2 = "".join(c for c in w if c.isalnum())
        if w2:
            out.append(w2)
    return "-".join(out) or "unit"


def guess_layer(area: str, summary: str) -> str:
    if area in HEADLESS_AREAS:
        return "headless"
    s = norm(summary)
    for k in E2E_KW:
        if k in s:
            return "e2e"
    for k in HEADLESS_KW:
        if k in s:
            return "headless"
    return "headless"  # API-CRUD default; area doc can flip to e2e


def detect_mock(summary: str) -> str:
    s = norm(summary)
    for kws, mock in MOCK_RULES:
        if any(k in s for k in kws):
            return mock
    return ""


def block_of(unit_id: str) -> int:
    """Hundred-block of a reserved id: 'bubble-admin-0510' -> 5."""
    return int(unit_id.rsplit("-", 1)[1]) // 100


def load_prior() -> dict[tuple[str, str, str], str]:
    """Map (area, uc, kind) -> previously-assigned unit_id from the existing backlog, so
    re-running keeps ids STABLE even when use cases are inserted mid-area. Without this,
    block allocation is row-order-dependent and an insert would renumber later units,
    orphaning any test/TAXONOMY row already written against the old id."""
    prior: dict[tuple[str, str, str], str] = {}
    if not OUT.exists():
        return prior
    lines = OUT.read_text(encoding="utf-8").splitlines()
    if not lines:
        return prior
    hdr = lines[0].split("\t")
    ix = {name: i for i, name in enumerate(hdr)}
    for line in lines[1:]:
        if not line.strip():
            continue
        c = line.split("\t")
        try:
            prior[(c[ix["area"]], c[ix["uc"]], c[ix["kind"]])] = c[ix["unit_id"]]
        except (KeyError, IndexError):
            continue
    return prior


def output_path(area: str, layer: str, unit_id: str, summary: str) -> str:
    sl = slug(summary)
    if layer == "e2e":
        return f"tests/e2e/{area}/{unit_id}-{sl}.yaml"
    return f"tests/headless/{area}/{unit_id}-{sl}.headless.test.ts"


def main() -> int:
    check = "--check" in sys.argv
    rows_out: list[list[str]] = []
    block_alloc: dict[str, int] = dict(NEXT_BLOCK)
    uc_block: dict[tuple[str, int], int] = {}  # (area, uc) -> reserved block
    prior = load_prior()
    # Start fresh allocation past every block any prior id already occupies, so newly
    # added use cases never reuse a preserved unit's block.
    for key, p_id in prior.items():
        p_area = key[0]
        try:
            block_alloc[p_area] = max(block_alloc.get(p_area, 1), block_of(p_id) + 1)
        except (ValueError, IndexError):
            continue

    with TSV_IN.open(encoding="utf-8") as fh:
        reader = csv.reader(fh, delimiter="\t")
        next(reader, None)  # header
        for raw in reader:
            if len(raw) <= C_SUMMARY:
                continue
            area_name = raw[C_AREA].strip()
            area = AREA_MAP.get(area_name)
            summary = raw[C_SUMMARY].strip()
            if not area or not summary:
                continue
            try:
                uc = int(raw[C_UC].strip())
            except (ValueError, IndexError):
                continue

            role = ROLE_MAP.get(raw[C_ROLES].strip(), "role-any")
            priority = (raw[C_PRIORITY].strip() or "Unassigned").split(" - ")[0].split(" -- ")[0]
            two_actor = "yes" if (len(raw) > C_TWO_ACCT and raw[C_TWO_ACCT].strip().lower() == "x") else ""
            sec = "security" if (len(raw) > C_SEC and raw[C_SEC].strip()) else ""
            neg_flagged = "yes" if (len(raw) > C_NEG_FLAG and raw[C_NEG_FLAG].strip().upper() == "X") else ""
            review = "review" if summary.startswith("**") else ""
            mock = detect_mock(summary)
            layer = guess_layer(area, summary)

            for kind in ("pos", "neg"):
                covered = COVERED.get((uc, kind))
                if covered:
                    unit_id, status = covered
                    existing = covered[0]
                else:
                    suffix = "00" if kind == "pos" else "10"
                    prior_self = prior.get((area, str(uc), kind))
                    if prior_self:  # keep the id this unit already had
                        unit_id = prior_self
                    else:
                        key = (area, uc)
                        if key in uc_block:
                            block = uc_block[key]
                        else:
                            # inherit the sibling's block if it was preserved, else allocate
                            sib = prior.get((area, str(uc), "neg" if kind == "pos" else "pos"))
                            block = block_of(sib) if sib else block_alloc[area]
                            if not sib:
                                block_alloc[area] += 1
                            uc_block[key] = block
                        unit_id = f"{area}-{block:02d}{suffix}"
                    existing = ""
                    if mock:
                        status = "blocked"
                    elif review:
                        status = "review"
                    else:
                        status = "todo"

                notes = []
                if mock:
                    notes.append(f"needs:{mock}")
                if two_actor:
                    notes.append("2-actor")
                if neg_flagged and kind == "neg":
                    notes.append("neg-flagged-in-tsv")
                if review:
                    notes.append("tsv-meta-row-review")
                tags = area
                if sec:
                    tags += f",{sec}"

                rows_out.append([
                    unit_id, area, layer, role, kind, str(uc), summary,
                    priority, tags, mock, status, existing,
                    output_path(area, layer, unit_id, summary), "; ".join(notes),
                ])

    # Wandering-path units (one per role) — not per-use-case; see tests/plan/wander/.
    for uid, role, doc in [
        ("wander-0100", "role-user", "wander-user.md"),
        ("wander-0200", "role-bubble-admin", "wander-bubble-admin.md"),
        ("wander-0300", "role-site-admin", "wander-site-admin.md"),
    ]:
        rows_out.append([
            uid, "wander", "e2e", role, "wander", "-",
            f"Multi-screen wandering path for {role} (see tests/plan/wander/{doc})",
            "5", "wander", "", "todo", "",
            f"tests/e2e/wander/{uid}-{role}.yaml", "tolerant; screenshots each stop",
        ])

    header = ["unit_id", "area", "layer", "roles", "kind", "uc", "uc_summary",
              "priority", "tags", "needs_mock", "status", "existing_test",
              "output_path", "notes"]
    lines = ["\t".join(header)]
    lines += ["\t".join(r) for r in rows_out]
    content = "\n".join(lines) + "\n"

    if check:
        old = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
        if old != content:
            print("backlog.tsv is stale — run: python3 scripts/gen_test_backlog.py", file=sys.stderr)
            return 1
        print("backlog.tsv up to date.")
        return 0

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(content, encoding="utf-8")
    todo = sum(1 for r in rows_out if r[10] == "todo")
    blocked = sum(1 for r in rows_out if r[10] == "blocked")
    done = sum(1 for r in rows_out if r[10] == "done")
    review = sum(1 for r in rows_out if r[10] == "review")
    print(f"[gen-backlog] wrote {OUT.relative_to(REPO)}: {len(rows_out)} units "
          f"({todo} todo, {blocked} blocked-on-mock, {review} review, {done} done).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
