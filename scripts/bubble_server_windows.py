#!/usr/bin/env python3
"""Set up 5 Terminal windows for local server development."""

HELP = """\
bubble_server_windows — set up Terminal windows on MacOS for local development. 

This is a non-required helper application, built for convenience and clarity. 
You can set up your windows any way you want. You can also run these 
processes inside of an LLM you're working with -- but only do that when 
there's a specific problem that you're solving. 

Otherwise, the token cost from having it filter information is rarely worth the value.

Commands:
  create           Create all windows (This is the default when no command given.)
  kill             Close all windows created by this script
  resize           Re-size and move existing windows, using the names below.
  show_boundaries  Print screen size and computed window bounds
  help             Show this message

Window names  (pass one name to act only on that window):
  API Server	-- starts the Api Server, displays the QR code for Expo Go app
  Metro Bundler	-- starts the Metro bundler, displays the QR code for Expo Go app
  iOS App		-- for compiling and launching the native app onto an iOS simulator
  Android App	-- for compiling and launching the native app onto an Android or Genymotion emulator
  General		-- for any purpose
  Testing		-- for test runs

Options:
  --screen WxH   Override auto-detected screen size (e.g. 2560x1440)
  --debug        Print detected screen dimensions before acting

Note — if new windows appear as tabs instead of separate windows:
  System Settings → Desktop & Dock →
  "Prefer tabs when opening documents" → In Full Screen Only (or Never)
\
"""

import argparse
import subprocess
import sys
import json
import re

# ---- Configuration ----
COVERAGE = 0.7          # fraction of screen to occupy
GAP = 10                # pixel gap between windows

NAMED_COLOR_PALETTES = {
    "Nord Modern Coder": {
        "fg": (46, 52, 64),
        "bg": (216, 222, 233),
    },
},

    

# Window definitions: name -> (bg_r, bg_g, bg_b, fg_r, fg_g, fg_b)
# Colors are in the 0-65535 Terminal.app RGB scale.
# Backgrounds: tinted-dark (gray floor ~10000 + dominant hue) so they read
# as colored rather than garish neon.
WIN_CONFIGS = {
    "API Server":    (10000, 12000, 40000, 65535, 65535, 65535),  # slate blue
    "Metro Bundler": (10000, 36000, 12000, 65535, 65535, 65535),  # forest green
    "iOS App":       (40000, 10000, 12000, 65535, 65535, 65535),  # deep crimson
    "Android App":   (28000, 10000, 42000, 65535, 65535, 65535),  # deep violet
    "General":       (16384, 16384, 16384, 65535, 65535,     0),  # slate gray / yellow text
    "Testing":       (16384, 16384, 16384, 65535, 65535,     0),  # slate gray / yellow text    
}

LAYOUT_ORDER = ["API Server", "Metro Bundler", "iOS App", "Android App", "General"]

# ---- Global storage for computed bounds ----
bounds = {}   # name -> (x, y, w, h)

# ---- Screen detection ----
def detect_screen():
    """Return (left, top, width, height) of the active screen in LOGICAL pixels.

    Three methods are tried in order of reliability:
      1. JXA / NSScreen.mainScreen  — always logical, always correct display
      2. system_profiler "UI Looks Like"  — logical for HiDPI modes
      3. Finder desktop bounds  — logical, but spans all displays on multi-monitor
    """
    # ---- Method 1: JXA NSScreen (logical pixels, active display) ----
    try:
        js = (
            "ObjC.import('AppKit');"
            "var f=$.NSScreen.mainScreen.frame;"
            "JSON.stringify({x:f.origin.x,y:f.origin.y,"
            "w:f.size.width,h:f.size.height})"
        )
        out = subprocess.check_output(
            ["osascript", "-l", "JavaScript", "-e", js],
            text=True, stderr=subprocess.DEVNULL,
        )
        d = json.loads(out)
        w, h = int(d["w"]), int(d["h"])
        if w > 0 and h > 0:
            return int(d["x"]), int(d["y"]), w, h
    except Exception:
        pass

    # ---- Method 2: system_profiler "UI Looks Like" (logical for HiDPI) ----
    try:
        output = subprocess.check_output(
            ["system_profiler", "SPDisplaysDataType"],
            stderr=subprocess.DEVNULL, text=True,
        )
        # "UI Looks Like: W x H" is present on HiDPI displays and gives logical px.
        ui_matches = re.findall(r"UI Looks Like:\s*(\d+)\s*x\s*(\d+)", output)
        if ui_matches:
            w, h = max(((int(a), int(b)) for a, b in ui_matches), key=lambda wh: wh[0] * wh[1])
            return 0, 0, w, h
        # "Resolution" fallback — this is the physical backing-store size on HiDPI
        # displays (e.g. 5120x2880 for a "looks like 2560x1440" external monitor).
        # Pick the largest display; if it looks like a HiDPI value, halve it.
        res_matches = re.findall(r"Resolution:\s*(\d+)\s*x\s*(\d+)", output)
        if res_matches:
            w, h = max(((int(a), int(b)) for a, b in res_matches), key=lambda wh: wh[0] * wh[1])
            if w > 2500:
                w, h = w // 2, h // 2
            return 0, 0, w, h
    except Exception:
        pass

    # ---- Method 3: Finder desktop bounds (logical, may span all displays) ----
    try:
        out = subprocess.check_output(
            ["osascript", "-e", 'tell application "Finder" to get bounds of window of desktop'],
            stderr=subprocess.DEVNULL, text=True,
        )
        parts = out.strip().split(",")
        if len(parts) == 4:
            left, top, right, bottom = map(int, parts)
            return left, top, right - left, bottom - top
    except Exception:
        pass

    return None

# ---- Escape string for AppleScript ----
def escape_as(s):
    return s.replace("\\", "\\\\").replace('"', '\\"')

# ---- Window management via osascript ----
def run_osascript(script):
    """Execute an AppleScript string and return stdout, or raise on error."""
    result = subprocess.run(
        ["osascript", "-e", script],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"AppleScript error: {result.stderr.strip()}")
    return result.stdout.strip()

def window_exists(name):
    """Check if any open Terminal tab has custom title matching name."""
    esc = escape_as(name)
    script = f'''tell application "Terminal"
    repeat with tw in (every window)
        repeat with t in (every tab of tw)
            if custom title of t is "{esc}" then return true
        end repeat
    end repeat
    return false
end tell'''
    try:
        out = run_osascript(script)
        return out.strip().lower() == "true"
    except Exception:
        return False

def create_window(name):
    """Create a new Terminal window with bounds, colors, and a title echo."""
    x, y, win_w, win_h = bounds[name]
    right = x + win_w
    bottom = y + win_h
    bg_r, bg_g, bg_b, fg_r, fg_g, fg_b = WIN_CONFIGS[name]
    esc = escape_as(name)

    # Terminal.app has no 'make new window'; do script "" (no 'in' clause) always
    # opens a new window and returns the new tab.  Colors are tab properties, not
    # window properties; bounds IS a window property.
    script = f'''tell application "Terminal"
    activate
    set newTab to do script "echo {esc}"
    delay 0.3
    set tw to front window
    set bounds of tw to {{{x}, {y}, {right}, {bottom}}}
    set background color of newTab to {{{bg_r}, {bg_g}, {bg_b}}}
    set normal text color of newTab to {{{fg_r}, {fg_g}, {fg_b}}}
    set custom title of newTab to "{esc}"
end tell'''
    run_osascript(script)

def resize_all():
    """Re-apply the stored bounds to all known windows."""
    for name in LAYOUT_ORDER:
        if name not in bounds:
            continue
        x, y, win_w, win_h = bounds[name]
        right = x + win_w
        bottom = y + win_h
        esc = escape_as(name)
        script = f'''tell application "Terminal"
    repeat with tw in (every window)
        repeat with t in (every tab of tw)
            if custom title of t is "{esc}" then
                set bounds of tw to {{{x}, {y}, {right}, {bottom}}}
                exit repeat
            end if
        end repeat
    end repeat
end tell'''
        try:
            run_osascript(script)
        except Exception as e:
            print(f"Warning: failed to resize {name}: {e}", file=sys.stderr)
    print("Resized all known windows.")

# ---- Layout computation ----
def compute_layout(screen_left, screen_top, screen_width, screen_height):
    """Fill the global bounds dict with integer positions and sizes."""
    total_width = screen_width
    total_height = screen_height

    work_width = int(total_width * COVERAGE)
    work_height = int(total_height * COVERAGE)

    left_offset = screen_left + (total_width - work_width) // 2
    top_offset = screen_top + (total_height - work_height) // 2

    row1_height = work_height * 3 // 10
    row2_height = work_height * 3 // 10
    row3_height = work_height * 4 // 10

    half_width = (work_width - GAP) // 2
    bot_width = work_width * 8 // 10
    bot_x = left_offset + (work_width - bot_width) // 2

    # Row 1
    bounds["API Server"] = (left_offset, top_offset, half_width, row1_height)
    bounds["Metro Bundler"] = (left_offset + half_width + GAP, top_offset, half_width, row1_height)

    # Row 2
    row2_y = top_offset + row1_height + GAP
    bounds["iOS App"] = (left_offset, row2_y, half_width, row2_height)
    bounds["Android App"] = (left_offset + half_width + GAP, row2_y, half_width, row2_height)

    # Row 3
    row3_y = row2_y + row2_height + GAP
    bounds["General"] = (bot_x, row3_y, bot_width, row3_height)

    # Clamp to screen bounds
    for name in LAYOUT_ORDER:
        x, y, w, h = bounds[name]
        if x < screen_left:
            x = screen_left
        if y < screen_top:
            y = screen_top
        if x + w > screen_left + total_width:
            w = screen_left + total_width - x
        if y + h > screen_top + total_height:
            h = screen_top + total_height - y
        bounds[name] = (x, y, w, h)

def show_boundaries():
    print(f"Screen bounds: {screen_left} {screen_top} {screen_left+screen_width} {screen_top+screen_height}")
    print("Windows:")
    for name in LAYOUT_ORDER:
        print(f"  {name:<15} -> {bounds[name]}")

# ---- Argument parsing ----
def parse_args():
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("command", nargs="?", default="create")
    parser.add_argument("-h", "--help", action="store_true", default=False)
    parser.add_argument("--screen", metavar="WxH")
    parser.add_argument("--debug", action="store_true")
    return parser.parse_args()


# ---- Window-name resolver ----
def resolve_window_name(raw):
    """Return the canonical name matching raw case-insensitively.

    Accepts the full name ('API Server', 'api server') or just the first word
    ('api', 'Api', 'iOS').  Returns None if no match.
    """
    lower = raw.lower()
    for name in LAYOUT_ORDER:
        if name.lower() == lower:
            return name
    for name in LAYOUT_ORDER:
        if name.split()[0].lower() == lower:
            return name
    return None

# ---- Window creation / destruction ----

def _create_windows(names):
    for name in names:
        if window_exists(name):
            print(f"Window '{name}' already exists, skipping.")
        else:
            print(f"Creating window '{name}'...")
            create_window(name)

def kill_all():
    """Close every Terminal window whose tab custom title matches a known name."""
    for name in LAYOUT_ORDER:
        esc = escape_as(name)
        script = f'''tell application "Terminal"
    repeat with tw in (every window)
        repeat with t in (every tab of tw)
            if custom title of t is "{esc}" then
                close tw
                exit repeat
            end if
        end repeat
    end repeat
end tell'''
        try:
            run_osascript(script)
            print(f"Closed '{name}'.")
        except Exception as e:
            print(f"Warning: could not close '{name}': {e}", file=sys.stderr)


# ---- Main ----
def main():
    global screen_left, screen_top, scr.en_width, screen_height
    args = parse_args()

    if args.help or args.command.lower() == "help":
        print(HELP)
        sys.exit(0)

    # Determine screen size
    manual_w = manual_h = 0
    if args.screen:
        match = re.match(r"^(\d+)x(\d+)$", args.screen)
        if not match:
            print("Invalid --screen format. Use WIDTHxHEIGHT.", file=sys.stderr)
            sys.exit(1)
        manual_w = int(match.group(1))
        manual_h = int(match.group(2))

    if manual_w > 0 and manual_h > 0:
        screen_left, screen_top, screen_width, screen_height = 0, 0, manual_w, manual_h
    else:
        detected = detect_screen()
        if not detected:
            print("Cannot detect screen size. Use --screen WIDTHxHEIGHT.", file=sys.stderr)
            sys.exit(1)
        screen_left, screen_top, screen_width, screen_height = detected

    if args.debug:
        print(f"Screen: left={screen_left}, top={screen_top}, width={screen_width}, height={screen_height}")

    # Compute layout once
    compute_layout(screen_left, screen_top, screen_width, screen_height)

    cmd = args.command.lower()
    if cmd == "show_boundaries":
        show_boundaries()
    elif cmd == "resize":
        resize_all()
    elif cmd == "kill":
        kill_all()
    elif cmd == "create":
        _create_windows(LAYOUT_ORDER)
    else:
        name = resolve_window_name(args.command)
        if name is None:
            print(f"Unknown command or window name: {args.command!r}", file=sys.stderr)
            print("Valid window names:", file=sys.stderr)
            for n in LAYOUT_ORDER:
                print(f"  {n}", file=sys.stderr)
            sys.exit(1)
        _create_windows([name])

if __name__ == "__main__":
    main()
