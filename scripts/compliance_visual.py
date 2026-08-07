#!/usr/bin/env python3
"""
compliance_visual.py — HOST-SIDE visual tier for the social-login compliance probe.  [STUB]

Maestro (auth-0320) verifies the accessibility-tree half of Sign-in-with-Apple
compliance and leaves the pixel/geometry half marked 'VISUAL' in its scorecard. This
script is the documented MERGE POINT for that other half: it reads the screenshot the
flow captured (and, for geometry, the view hierarchy that `maestro test --debug-output`
wrote) and returns a real OK/FAIL verdict per VISUAL requirement, which the caller folds
back into the same scorecard for a single combined compliance report.

Everything below is a STUB: signatures, the requirement each check maps to (App Review
Guideline / HIG), and the inputs it needs. No image analysis is implemented yet — each
check returns 'TODO'. Wire the bodies (Pillow/OpenCV for pixels, the hierarchy JSON for
bounds) when the visual tier is prioritised.

Usage (once implemented):
    python3 scripts/compliance_visual.py \
        --screenshot tests/output/<run>/e2e/auth-0320/*compliance-welcome-social.png \
        --hierarchy  tests/output/<run>/e2e/auth-0320/<step>/hierarchy.json \
        --platform ios
    -> prints JSON: { "apple-icon-official": "OK"|"FAIL"|"TODO", ... }
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# The VISUAL requirements Maestro cannot judge, and the rule each enforces.
VISUAL_CHECKS = {
    "apple-icon-official":
        "HIG: the Apple mark/button uses official artwork, unmodified (immediate rejection if altered).",
    "apple-google-size-parity":
        "Guideline (visual prominence): the Apple button is at least equal in size and "
        "prominence to Google — reviewers verify parity. Compare element bounds from the hierarchy.",
    "buttons-not-stretched":
        "HIG: the social buttons keep their intended aspect ratio (not stretched/squashed).",
    "apple-icon-darkmode":
        "HIG: the correct light/dark artwork variant renders for the active appearance "
        "(requires a second capture with the simulator in dark mode).",
}


def check_apple_icon_official(screenshot: Path, platform: str) -> str:
    """TODO: crop the Apple button region and template/feature-match against the official
    Apple logo asset. FAIL if the mark is recolored, distorted, or replaced."""
    return "TODO"


def check_size_parity(hierarchy: Path | None, platform: str) -> str:
    """TODO: read `bounds` for button-apple-signin and button-google-signin from the
    hierarchy JSON; FAIL if the Apple button's width/height is materially smaller than
    Google's (parity = equal size + prominence)."""
    return "TODO"


def check_not_stretched(hierarchy: Path | None, screenshot: Path) -> str:
    """TODO: compare rendered button aspect ratios to the design spec; FAIL if distorted."""
    return "TODO"


def check_icon_darkmode(screenshot_dark: Path | None, platform: str) -> str:
    """TODO: requires a dark-mode capture (xcrun simctl ui <dev> appearance dark). FAIL
    if the light-mode artwork is shown against a dark background (or vice-versa)."""
    return "TODO"


def run(screenshot: Path, hierarchy: Path | None, platform: str) -> dict[str, str]:
    """Return {requirement: verdict} for the VISUAL tier. Merge these into the Maestro
    scorecard: a value overrides the flow's 'VISUAL' placeholder for that key."""
    return {
        "apple-icon-official": check_apple_icon_official(screenshot, platform),
        "apple-google-size-parity": check_size_parity(hierarchy, platform),
        "buttons-not-stretched": check_not_stretched(hierarchy, screenshot),
        "apple-icon-darkmode": check_icon_darkmode(None, platform),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Host-side visual tier for social-login compliance (STUB).")
    ap.add_argument("--screenshot", type=Path, help="compliance-welcome-social.png from auth-0320")
    ap.add_argument("--hierarchy", type=Path, default=None, help="view-hierarchy JSON (from --debug-output) for bounds")
    ap.add_argument("--platform", choices=["ios", "android"], default="ios")
    ap.add_argument("--list", action="store_true", help="list the VISUAL requirements and exit")
    args = ap.parse_args()

    if args.list:
        for k, why in VISUAL_CHECKS.items():
            print(f"{k}\n    {why}")
        return 0

    if args.screenshot is None:
        ap.error("--screenshot is required (unless --list)")
    if not args.screenshot.exists():
        print(f"error: screenshot not found: {args.screenshot}", file=sys.stderr)
        return 2

    verdicts = run(args.screenshot, args.hierarchy, args.platform)
    print(json.dumps(verdicts, indent=2))
    # STUB: nothing is implemented, so this never fails a build yet. Once wired, exit 1
    # if any verdict is FAIL so CI can gate on the combined compliance result.
    if "FAIL" in verdicts.values():
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
