"""Toolchain capability probe for the dev tooling.

Answers "what platforms can this host actually drive?" (Xcode/simctl, Android SDK/adb/
emulator, emulator images, Genymotion) and emits AT MOST ONE consolidated warning per
process about a missing toolchain — so the many device functions don't each warn (e.g.
"Xcode present but no Android Studio", or "Android SDK present but no emulator images").

Pure probe: no DB, no device mutation. `capabilities()` is cached per process.
"""
import os
import shutil
import subprocess
from functools import lru_cache
from pathlib import Path


def _android_home():
    for k in ("ANDROID_HOME", "ANDROID_SDK_ROOT"):
        v = os.environ.get(k)
        if v and Path(v).exists():
            return Path(v)
    d = Path.home() / "Library" / "Android" / "sdk"
    return d if d.exists() else None


def _sdk_bin(home, rel, name):
    if shutil.which(name):
        return shutil.which(name)
    if home and (home / rel).exists():
        return str(home / rel)
    return None


@lru_cache(maxsize=1)
def capabilities():
    """Cached dict of present toolchains/binaries. Keys: xcode, simctl, android_sdk,
    adb, emulator, avd_images, genymotion."""
    home = _android_home()
    adb = _sdk_bin(home, "platform-tools/adb", "adb")
    emulator = _sdk_bin(home, "emulator/emulator", "emulator")
    avd_images = False
    if emulator:
        try:
            r = subprocess.run([emulator, "-list-avds"], stdout=subprocess.PIPE,
                               stderr=subprocess.DEVNULL, text=True, timeout=15)
            avd_images = bool((r.stdout or "").strip())
        except Exception:
            avd_images = False
    xcrun = bool(shutil.which("xcrun"))
    return {
        "xcode": xcrun,
        "simctl": xcrun,                       # simctl is invoked via xcrun
        "android_sdk": home is not None,
        "adb": adb is not None,
        "emulator": emulator is not None,
        "avd_images": avd_images,
        "genymotion": bool(shutil.which("gmtool")),
    }


_warned = False


def warn_missing_once(emit):
    """Emit ONE consolidated warning (via callable `emit`, e.g. a stderr printer) about
    missing toolchains. No-op after the first call per process, so device functions can
    fail/return-empty quietly while the user still learns WHY, exactly once."""
    global _warned
    if _warned:
        return
    _warned = True
    cap = capabilities()
    msgs = []
    if not cap["xcode"]:
        msgs.append("Xcode/xcrun not found — iOS (sim + real) unavailable.")
    if not (cap["android_sdk"] and cap["adb"]):
        msgs.append("Android SDK/adb not found — Android (emulator + real) unavailable.")
    elif not cap["avd_images"]:
        msgs.append("Android SDK present but no emulator AVDs — only real Android devices.")
    if msgs:
        emit("device-tooling: " + "  ".join(msgs))
