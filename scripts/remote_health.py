#!/usr/bin/env python3
"""Health check for the remotely-hosted Expo Go staging server.
    Author: Travis Winfrey & Claude
    Date: April 2026
"""

import argparse
import hashlib
import json
import re
import socket
import subprocess
import shutil
import sys
import tarfile
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from datetime import datetime
from pathlib import Path

TARGET_URL = "https://bubble-mobile.replit.app/qr-code"
REPLIT_LOGIN_URL = "replit.com/login"
STATE_FILE = Path.home() / ".remote_health_state.json"

RESPONSE_WARN_SECONDS = 4
RESPONSE_FAIL_SECONDS = 10


def timestamp():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def log(msg, verbose):
    if verbose:
        print(f"[{timestamp()}] {msg}")


def warn(msg):
    print(f"{timestamp()}  WARN  {msg}")


def fail(msg):
    print(f"{timestamp()}  FAIL  {msg}", file=sys.stderr)
    sys.exit(1)


# ---------------------------------------------------------------------------
# State (ETag + first-seen timestamp + last known exp:// URL)
# ---------------------------------------------------------------------------

def load_state():
    try:
        return json.loads(STATE_FILE.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save_state(state):
    try:
        STATE_FILE.write_text(json.dumps(state, indent=2))
    except OSError as e:
        warn(f"Could not save state to {STATE_FILE}: {e}")


# ---------------------------------------------------------------------------
# Fetch
# ---------------------------------------------------------------------------

def fetch_page(verbose):
    log(f"Fetching {TARGET_URL}", verbose)

    state = load_state()
    request = urllib.request.Request(TARGET_URL)
    if state.get("etag"):
        log(f"Sending If-None-Match: {state['etag']}", verbose)
        request.add_header("If-None-Match", state["etag"])

    final_url_holder = []

    class RedirectTracker(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            log(f"Redirect → {newurl}", verbose)
            final_url_holder.append(newurl)
            return super().redirect_request(req, fp, code, msg, headers, newurl)

    opener = urllib.request.build_opener(RedirectTracker())

    t0 = time.monotonic()
    try:
        with opener.open(request, timeout=RESPONSE_FAIL_SECONDS) as response:
            elapsed = time.monotonic() - t0
            status = response.status
            etag = response.headers.get("ETag", "")
            content_type = response.headers.get("Content-Type", "")
            final_url = response.geturl()
            html = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        elapsed = time.monotonic() - t0
        if e.code == 304:
            log(f"304 Not Modified ({elapsed:.2f}s)", verbose)
            return None, elapsed, 304, None
        fail(f"Site returned HTTP {e.code}: {e.reason}")
    except urllib.error.URLError as e:
        if isinstance(e.reason, socket.gaierror):
            fail("No network available (DNS lookup failed)")
        if "timed out" in str(e.reason).lower():
            fail(f"Site did not respond within {RESPONSE_FAIL_SECONDS}s — site may be down")
        fail(f"Site is not up: {e.reason}")
    except OSError as e:
        fail(f"Network error: {e}")

    # Redirect to login
    if any(REPLIT_LOGIN_URL in u for u in final_url_holder) or REPLIT_LOGIN_URL in final_url:
        fail("Site redirected to replit.com/login — app may be set to private")

    # Response time
    log(f"Response time: {elapsed:.2f}s  status={status}  etag={etag!r}  content-type={content_type}", verbose)
    if elapsed >= RESPONSE_WARN_SECONDS:
        warn(f"Slow response: {elapsed:.2f}s (threshold {RESPONSE_WARN_SECONDS}s)")

    # Any non-200 that slips past the HTTPError handler
    if status != 200:
        fail(f"Unexpected HTTP status {status}")

    # Content-Type sanity check
    if "text/html" not in content_type:
        warn(f"Unexpected Content-Type: {content_type!r}")

    log(f"Downloaded {len(html)} bytes", verbose)
    return html, elapsed, 200, etag


# ---------------------------------------------------------------------------
# Validate
#  - Check out the extracted HTML. Look for a few failure modes.
#  - find the exp:// URL
#  - validate and return
# ---------------------------------------------------------------------------

def validate_and_extract(html, verbose):
    # Private-website gate
    if "private website" in html.lower():
        fail("Site reports it is a private website")

    # exp:// URL
    match = re.search(r'exp://[^\s"\'<>&]+', html)
    if not match:
        fail("No exp:// URL found on the page")

    exp_url = match.group(0)
    log(f"Found exp:// URL: {exp_url}", verbose)

    # Basic structure check — expect a QR code image somewhere on the page
    if not re.search(r'<img\b', html, re.IGNORECASE):
        warn("No <img> tag found — QR code image may be missing")

    # Validate that the exp:// URL has a non-empty host
    parsed_host = exp_url[len("exp://"):].split("/")[0].split("?")[0]
    if not parsed_host:
        fail("exp:// URL has no host component — malformed URL")
    log(f"exp:// host: {parsed_host}", verbose)

    return exp_url


# ---------------------------------------------------------------------------
# Expo Go installer
# ---------------------------------------------------------------------------

EXPO_GO_RELEASES_API = "https://api.github.com/repos/expo/expo-go-releases/releases"
EXPO_GO_CACHE_DIR = Path.home() / ".expo_go_cache"


def _find_sha256_in_body(body_text, filename):
    """Return a SHA256 hex string found within 300 chars of filename in body_text, or None."""
    idx = body_text.find(filename)
    if idx == -1:
        return None
    window = body_text[max(0, idx - 300):idx + len(filename) + 300]
    m = re.search(r'[0-9a-f]{64}', window, re.IGNORECASE)
    return m.group(0).lower() if m else None


def _verify_sha256(path, expected_hex, verbose):
    log(f"Verifying SHA256 of {path.name}...", verbose)
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    actual = h.hexdigest()
    if actual != expected_hex.lower():
        raise ValueError(
            f"SHA256 mismatch for {path.name}\n"
            f"  expected: {expected_hex}\n"
            f"  actual:   {actual}"
        )
    log(f"SHA256 OK: {actual}", verbose)


def _do_install(platform, asset_path, tag_name, verbose, serial=None):
    """Extract and install a cached Expo Go asset into the running simulator/emulator."""
    if platform == "ios":
        with tempfile.TemporaryDirectory() as tmpdir:
            # The archive extracts flat, so extract into a named .app directory.
            app_path = Path(tmpdir) / "ExpoGo.app"
            app_path.mkdir()
            log(f"Extracting {asset_path.name} → {app_path.name}...", verbose)
            with tarfile.open(asset_path) as tf:
                tf.extractall(app_path, filter="data")
            target = serial or "booted"
            log(f"Installing {app_path.name} into simulator {target}...", verbose)
            result = subprocess.run(
                ["xcrun", "simctl", "install", target, str(app_path)],
                capture_output=True, text=True,
            )
            if result.returncode != 0:
                fail(f"xcrun simctl install failed: {result.stderr.strip()}")
    else:
        log(f"Installing {asset_path.name} via adb...", verbose)
        cmd = ["adb"]
        if serial:
            cmd += ["-s", serial]
        cmd += ["install", "-r", str(asset_path)]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            fail(f"adb install failed: {result.stderr.strip() or result.stdout.strip()}")

    target = "simulator" if platform == "ios" else "emulator"
    print(f"{timestamp()}  OK    Installed Expo Go {tag_name} into {target}")


def install_expo_go(platform, sdk_version, verbose, serial=None):
    """Download and install Expo Go for 'ios' or 'android'.
    sdk_version: major SDK number (e.g. '55'), or None to use the latest release.
    Downloads are cached in ~/.expo_go_cache by full release tag.
    """
    if sdk_version:
        log(f"Fetching Expo Go release list for SDK {sdk_version} ({platform})...", verbose)
    else:
        log(f"Fetching latest Expo Go release for {platform}...", verbose)

    req = urllib.request.Request(
        EXPO_GO_RELEASES_API,
        headers={"User-Agent": "remote_health.py", "Accept": "application/vnd.github+json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            releases = json.loads(resp.read())
    except Exception as e:
        fail(f"Could not fetch Expo Go release list: {e}")

    suffix = ".tar.gz" if platform == "ios" else ".apk"
    asset_url = asset_name = tag_name = sha256_hash = None

    for release in releases:
        tag = release.get("tag_name", "")
        if sdk_version and not tag.startswith(f"Expo-Go-{sdk_version}."):
            continue
        for asset in release.get("assets", []):
            if asset["name"].endswith(suffix):
                tag_name = tag
                asset_name = asset["name"]
                asset_url = asset["browser_download_url"]
                sha256_hash = _find_sha256_in_body(release.get("body", ""), asset["name"])
                break
        if asset_url:
            break

    if not asset_url:
        qualifier = f"SDK {sdk_version}" if sdk_version else "any SDK"
        fail(
            f"No Expo Go {platform} build found for {qualifier}.\n"
            f"       Browse releases at: https://github.com/expo/expo-go-releases/releases"
        )

    if sha256_hash:
        log(f"Expected SHA256: {sha256_hash}", verbose)
    else:
        warn(f"No SHA256 hash found in release notes for {asset_name} — skipping verification")

    # Serve from cache when available and hash checks out
    cached_file = EXPO_GO_CACHE_DIR / tag_name / asset_name
    if cached_file.exists():
        log(f"Cache hit: {cached_file}", verbose)
        if sha256_hash:
            try:
                _verify_sha256(cached_file, sha256_hash, verbose)
            except ValueError as e:
                warn(f"Cached file failed verification, re-downloading: {e}")
                cached_file.unlink()
        if cached_file.exists():
            _do_install(platform, cached_file, tag_name, verbose, serial)
            return

    cached_file.parent.mkdir(parents=True, exist_ok=True)
    log(f"Downloading {tag_name} ({platform})...", verbose)
    try:
        urllib.request.urlretrieve(asset_url, cached_file)
    except Exception as e:
        cached_file.unlink(missing_ok=True)
        fail(f"Download failed: {e}")

    if sha256_hash:
        try:
            _verify_sha256(cached_file, sha256_hash, verbose)
        except ValueError as e:
            cached_file.unlink(missing_ok=True)
            fail(str(e))

    _do_install(platform, cached_file, tag_name, verbose, serial)


# ---------------------------------------------------------------------------
# Device selection helpers
# ---------------------------------------------------------------------------

def _require_tool(cmd, install_hint):
    """Fail immediately if cmd is not on PATH, with a helpful installation message."""
    if shutil.which(cmd) is None:
        fail(f"`{cmd}` not found in PATH — {install_hint}")


def _emu_info(serial):
    """Return a dict with identity details for one adb device serial."""
    def getprop(prop):
        r = subprocess.run(
            ["adb", "-s", serial, "shell", "getprop", prop],
            capture_output=True, text=True, timeout=5,
        )
        return r.stdout.strip() if r.returncode == 0 else "?"

    avd_name = None
    if serial.startswith("emulator-"):
        r = subprocess.run(
            ["adb", "-s", serial, "emu", "avd", "name"],
            capture_output=True, text=True, timeout=5,
        )
        if r.returncode == 0:
            lines = [l.strip() for l in r.stdout.splitlines() if l.strip() and l.strip() != "OK"]
            avd_name = lines[0] if lines else None

    avd = avd_name or serial
    android = getprop("ro.build.version.release")
    model = getprop("ro.product.model")
    return {
        "serial":  serial,
        "avd":     avd,
        "android": android,
        "model":   model,
        "label":   f"{avd:<42}  Android {android}  ({model})",
    }


def _foreground_emulator(avd_name):
    """Best-effort: raise the emulator window whose title contains avd_name (macOS only)."""
    script = f"""
    tell application "System Events"
        repeat with p in (every process whose name starts with "qemu-system")
            try
                repeat with w in (every window of p)
                    if name of w contains "{avd_name}" then
                        set frontmost of p to true
                        return
                    end if
                end repeat
            end try
        end repeat
    end tell
    """
    subprocess.run(["osascript", "-e", script], capture_output=True)


def user_chooses_from(items, foreground_fn=None):
    """Print a numbered menu of items (each needs a 'label' key), return chosen dict.

    foreground_fn: optional callable(item) invoked for each item before the prompt
                   so the user can visually identify the windows.
    """
    print(f"\nMultiple devices found — pick one:\n")
    for i, item in enumerate(items, 1):
        print(f"  {i})  {item['label']}")
    if foreground_fn:
        print()
        print("  (Bringing each to the front briefly so you can identify them...)")
        for item in items:
            foreground_fn(item)
            time.sleep(0.7)
    print()
    while True:
        try:
            raw = input(f"Enter number [1-{len(items)}]: ").strip()
            choice = int(raw)
            if 1 <= choice <= len(items):
                return items[choice - 1]
        except (ValueError, EOFError):
            pass
        print(f"  Please enter a number between 1 and {len(items)}.")


def choose_android_emulator():
    """Return the adb serial to use, prompting the user if multiple devices are running."""
    devices = subprocess.run(["adb", "devices"], capture_output=True, text=True)
    if devices.returncode != 0:
        fail(f"adb error: {devices.stderr.strip()}")

    serials = [
        line.split()[0]
        for line in devices.stdout.splitlines()[1:]
        if line.strip() and "offline" not in line
    ]
    if not serials:
        fail("No running Android emulator found — launch one in Android Studio first")

    if len(serials) == 1:
        return serials[0]

    emulators = [_emu_info(s) for s in serials]
    chosen = user_chooses_from(emulators, foreground_fn=lambda e: _foreground_emulator(e["avd"]))
    return chosen["serial"]


def _sim_info(sim_dict, runtime_key):
    """Return a display dict for one booted iOS simulator."""
    # "com.apple.CoreSimulator.SimRuntime.iOS-17-2" → "iOS 17.2"
    ios_ver = runtime_key.split(".")[-1].replace("-", " ", 1).replace("-", ".")
    name = sim_dict["name"]
    return {
        "udid":  sim_dict["udid"],
        "name":  name,
        "ios":   ios_ver,
        "label": f"{name:<42}  {ios_ver}",
    }


def choose_ios_simulator():
    """Return the udid of the simulator to use, prompting the user if multiple are booted."""
    result = subprocess.run(
        ["xcrun", "simctl", "list", "devices", "booted", "--json"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        fail(f"xcrun simctl error: {result.stderr.strip()}")

    data = json.loads(result.stdout)
    sims = [
        _sim_info(d, runtime_key)
        for runtime_key, devices in data.get("devices", {}).items()
        for d in devices
        if d.get("state") == "Booted"
    ]
    if not sims:
        fail("No booted iOS simulator found — launch one in Xcode first")
    if len(sims) == 1:
        return sims[0]["udid"]

    chosen = user_chooses_from(sims)
    return chosen["udid"]


def _parse_gmtool_list(output):
    """Parse 'gmtool admin list' output, return dicts for running devices only."""
    devices = []
    for line in output.splitlines():
        parts = [p.strip() for p in line.split("|")]
        if len(parts) >= 5 and parts[0].lower() == "on" and parts[4]:
            name, android, ip = parts[2], parts[3], parts[4]
            serial = f"{ip}:5555"
            devices.append({
                "serial": serial,
                "avd":    name,
                "label":  f"{name:<42}  Android {android}  ({serial})",
            })
    return devices


def choose_genymotion_device():
    """Return the adb serial for a Genymotion device, prompting if multiple are running."""
    result = subprocess.run(["gmtool", "admin", "list"], capture_output=True, text=True)
    if result.returncode != 0:
        fail(f"gmtool error: {result.stderr.strip()}")

    devices = _parse_gmtool_list(result.stdout)
    if not devices:
        fail("No running Genymotion device — launch one in Genymotion Desktop first")
    if len(devices) == 1:
        return devices[0]["serial"]

    chosen = user_chooses_from(devices)
    return chosen["serial"]


# ---------------------------------------------------------------------------
# Platform launchers
# ---------------------------------------------------------------------------

def open_ios(exp_url, verbose, reinstall=False, expo_sdk=None):
    _require_tool("xcrun", "install Xcode from the App Store, or run: xcode-select --install")
    log(f"Opening in iOS simulator: {exp_url}", verbose)
    try:
        udid = choose_ios_simulator()

        if reinstall:
            subprocess.run(
                ["xcrun", "simctl", "uninstall", udid, "host.exp.Exponent"],
                capture_output=True, text=True,
            )

        expo_check = subprocess.run(
            ["xcrun", "simctl", "get_app_container", udid, "host.exp.Exponent"],
            capture_output=True, text=True,
        )
        if expo_check.returncode != 0:
            install_expo_go("ios", expo_sdk, verbose, serial=udid)
            expo_check = subprocess.run(
                ["xcrun", "simctl", "get_app_container", udid, "host.exp.Exponent"],
                capture_output=True, text=True,
            )
            if expo_check.returncode != 0:
                fail("Expo Go install appeared to succeed but app is still not found")
        log(f"Expo Go found at: {expo_check.stdout.strip()}", verbose)

        result = subprocess.run(
            ["xcrun", "simctl", "openurl", udid, exp_url],
            capture_output=True, text=True,
        )
        if result.returncode != 0:
            fail(f"iOS simulator error: {result.stderr.strip() or result.stdout.strip()}")
    except FileNotFoundError:
        fail("xcrun not found — is Xcode installed?")
    print(f"{timestamp()}  OK    Opened in iOS simulator")


def open_android(exp_url, verbose, reinstall=False, expo_sdk=None):
    _require_tool("adb", "install Android SDK via Android Studio, or run: brew install android-platform-tools")
    try:
        serial = choose_android_emulator()

        if reinstall:
            log("Uninstalling Expo Go", verbose)
            subprocess.run(
                ["adb", "-s", serial, "shell", "pm", "uninstall", "--user", "0", "host.exp.exponent"],
                capture_output=True, text=True,
            )

        log("Checking for Expo Go", verbose)
        pkg_check = subprocess.run(
            ["adb", "-s", serial, "shell", "pm", "list", "packages", "host.exp.exponent"],
            capture_output=True, text=True,
        )
        if "host.exp.exponent" not in pkg_check.stdout:
            install_expo_go("android", expo_sdk, verbose, serial)
            pkg_check = subprocess.run(
                ["adb", "-s", serial, "shell", "pm", "list", "packages", "host.exp.exponent"],
                capture_output=True, text=True,
            )
            if "host.exp.exponent" not in pkg_check.stdout:
                fail("Expo Go install appeared to succeed but app is still not found")

        result = subprocess.run(
            ["adb", "-s", serial, "shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", exp_url],
            capture_output=True, text=True,
        )
        if result.returncode != 0:
            fail(f"Android emulator error: {result.stderr.strip() or result.stdout.strip()}")
    except FileNotFoundError:
        fail("adb not found — is Android SDK installed and adb in PATH?")
    print(f"{timestamp()}  OK    Opened in Android emulator")


def open_genymotion(exp_url, verbose, reinstall=False, expo_sdk=None):
    _require_tool("adb", "install Android SDK via Android Studio, or run: brew install android-platform-tools")
    _require_tool("gmtool", "install Genymotion Desktop from https://www.genymotion.com and add /Applications/Genymotion.app/Contents/MacOS to PATH")
    try:
        serial = choose_genymotion_device()

        if reinstall:
            log("Uninstalling Expo Go", verbose)
            subprocess.run(
                ["adb", "-s", serial, "shell", "pm", "uninstall", "--user", "0", "host.exp.exponent"],
                capture_output=True, text=True,
            )

        log("Checking for Expo Go", verbose)
        pkg_check = subprocess.run(
            ["adb", "-s", serial, "shell", "pm", "list", "packages", "host.exp.exponent"],
            capture_output=True, text=True,
        )
        if "host.exp.exponent" not in pkg_check.stdout:
            install_expo_go("android", expo_sdk, verbose, serial)
            pkg_check = subprocess.run(
                ["adb", "-s", serial, "shell", "pm", "list", "packages", "host.exp.exponent"],
                capture_output=True, text=True,
            )
            if "host.exp.exponent" not in pkg_check.stdout:
                fail("Expo Go install appeared to succeed but app is still not found")

        result = subprocess.run(
            ["adb", "-s", serial, "shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", exp_url],
            capture_output=True, text=True,
        )
        if result.returncode != 0:
            fail(f"Genymotion emulator error: {result.stderr.strip() or result.stdout.strip()}")
    except FileNotFoundError:
        fail("adb not found — is Android SDK installed and adb in PATH?")
    print(f"{timestamp()}  OK    Opened in Genymotion emulator")


def open_web(exp_url, verbose):
    web_url = exp_url.replace("exp://", "https://", 1)
    log(f"Opening in default browser: {web_url}", verbose)
    webbrowser.open(web_url)
    print(f"{timestamp()}  OK    Opened in browser: {web_url}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Health check for the remote Expo Go staging server."
    )
    parser.add_argument("-v", "--verbose",   action="store_true", help="Log actions")
    parser.add_argument("-i", "--ios",       action="store_true", help="Open in iOS simulator")
    parser.add_argument("-a", "--android",   action="store_true", help="Open in Android emulator")
    parser.add_argument("-g", "--genymotion", action="store_true", help="Open in Genymotion emulator")
    parser.add_argument("-r", "--reinstall", action="store_true", help="Force reinstallation")
    parser.add_argument("-w", "--web",       action="store_true", help="Open in default browser")
    parser.add_argument("--expo-sdk",        metavar="VERSION",   help="Expo SDK version for Expo Go (e.g. 55)")

    source = parser.add_mutually_exclusive_group()
    source.add_argument("--remote",  action="store_true", help="Fetch exp:// URL from the remote staging server (default)")
    source.add_argument("--local",   action="store_true", help="Use exp://localhost:8081 without fetching remote")
    source.add_argument("--exp_url", metavar="URL",       help="Use the specified exp:// URL directly")
    args = parser.parse_args()

    has_platform = args.ios or args.android or args.genymotion or args.web
    use_remote = not (args.local or args.exp_url)

    if use_remote:
        html, elapsed, status, etag = fetch_page(args.verbose)

        if status == 304:
            state = load_state()
            exp_url   = state.get("exp_url", "")
            first_seen = state.get("first_seen", "unknown")
            if not exp_url:
                fail("304 received but no cached exp:// URL — delete state file and retry")
            if not has_platform:
                print(f"{timestamp()}  OK    Unchanged build  ({elapsed:.2f}s)  first seen: {first_seen}  {exp_url}")
                sys.exit(0)
        else:
            exp_url = validate_and_extract(html, args.verbose)
            save_state({"etag": etag, "first_seen": timestamp(), "exp_url": exp_url})
            if not has_platform:
                print(f"{timestamp()}  OK    New build  ({elapsed:.2f}s)  {exp_url}")
                sys.exit(0)
    elif args.local:
        exp_url = "exp://localhost:8081"
        log(f"Using local URL: {exp_url}", args.verbose)
        if not has_platform:
            print(f"{timestamp()}  OK    {exp_url}")
            sys.exit(0)
    else:
        exp_url = args.exp_url
        log(f"Using provided URL: {exp_url}", args.verbose)
        if not has_platform:
            print(f"{timestamp()}  OK    {exp_url}")
            sys.exit(0)

    if args.ios:
        open_ios(exp_url, args.verbose, args.reinstall, args.expo_sdk)
    if args.android:
        open_android(exp_url, args.verbose, args.reinstall, args.expo_sdk)
    if args.genymotion:
        open_genymotion(exp_url, args.verbose, args.reinstall, args.expo_sdk)
    if args.web:
        open_web(exp_url, args.verbose)


if __name__ == "__main__":
    main()
