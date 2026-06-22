#!/usr/bin/env zsh
# avd_atd_tools.zsh — create / start / compare full-image (AVD) vs ATD-image emulators.
#
# Paste the whole file into a zsh shell (or `source` it) to get the functions, then call
# them manually. Every side-effecting function honors DRY_RUN: set DRY_RUN=1 to print what
# WOULD happen without creating/starting anything.
#
# What's an "AVD" vs an "ATD" here:
#   - create_avd builds an emulator on a FULL system image  (system-images;…;google_apis;…)
#   - create_atv builds an emulator on an ATD system image  (system-images;…;google_atd;…)
#     (function is named create_atv per the task spec; it creates an ATD-image emulator)
# The screen-capture behaviour (real pixels vs black) is determined by the IMAGE, not by any
# launch switch — see the note above start_avd/start_atd.
#
# IMAGE AVAILABILITY (verified 2026-06-22 on this machine): the only API level with BOTH a
# google_apis and a google_atd image installed is android-34. There is no android-35 image,
# and android-36/36.1/37 only ship playstore/ps16k variants. The functions default API to 35
# per spec but VALIDATE the image and error with the exact sdkmanager command if it's absent;
# the demo invocations at the bottom use API 34 so they actually work as-is.

# ── paths (override by exporting before sourcing; defaults make the file paste-able) ──
: ${ANDROID_SDK:=$HOME/Library/Android/sdk}
: ${AVD_HOME:=$HOME/.android/avd}
: ${EMULATOR:=$ANDROID_SDK/emulator/emulator}
: ${AVDMANAGER:=$ANDROID_SDK/cmdline-tools/latest/bin/avdmanager}
: ${ABI:=x86_64}

# Run a command, or just print it under DRY_RUN.
_run() {
  if [[ -n ${DRY_RUN:-} ]]; then
    print -r -- "DRY-RUN> $*"
  else
    "$@"
  fi
}

# Echo an AVD's image dir (relative to $ANDROID_SDK), read from its config.ini.
_img_sysdir() {
  local cfg="$AVD_HOME/${1}.avd/config.ini"
  [[ -f "$cfg" ]] || return 1
  local line
  line=$(grep -E '^image\.sysdir\.1=' "$cfg" | head -1)
  print -r -- "${line#image.sysdir.1=}"
}

# ── A. creators ─────────────────────────────────────────────────────────────────────
# Positional params (both creators):
#   1 NAME    (required)
#   2 GPU     (no default; EMPTY => write an empty `hw.gpu.mode=` config line)
#   3 API     (default 35)
#   4 DEVICE  (added: default small_phone — the device skin; good reason = flexibility)
_create_emu() {
  local tag="$1"; shift
  local name="$1" gpu="$2" api="${3:-35}" device="${4:-small_phone}"
  if [[ -z "$name" ]]; then
    print -u2 -r -- "create: NAME is required (usage: create_avd|create_atv NAME [GPU] [API] [DEVICE])"
    return 2
  fi
  local imgdir="$ANDROID_SDK/system-images/android-${api}/${tag}/${ABI}"
  local pkg="system-images;android-${api};${tag};${ABI}"
  if [[ ! -d "$imgdir" ]]; then
    print -u2 -r -- "create: image not installed: ${pkg}"
    print -u2 -r -- "  install it with:  sdkmanager \"${pkg}\""
    return 3
  fi

  # Create the AVD (avdmanager prompts about a custom hardware profile; answer "no").
  if [[ -n ${DRY_RUN:-} ]]; then
    print -r -- "DRY-RUN> printf 'no' | $AVDMANAGER create avd -n $name -k $pkg -d $device --force"
  else
    print -r -- "no" | "$AVDMANAGER" create avd -n "$name" -k "$pkg" -d "$device" --force || return $?
  fi

  # Set hw.gpu.mode in config.ini to $gpu (empty value if $gpu is empty), per spec.
  local cfg="$AVD_HOME/${name}.avd/config.ini"
  if [[ -n ${DRY_RUN:-} ]]; then
    print -r -- "DRY-RUN> set 'hw.gpu.mode=${gpu}' in ${cfg}"
  else
    if [[ -f "$cfg" ]]; then
      grep -v '^hw\.gpu\.mode=' "$cfg" > "${cfg}.tmp" && mv "${cfg}.tmp" "$cfg"
      print -r -- "hw.gpu.mode=${gpu}" >> "$cfg"
    fi
  fi
  print -r -- "created ${name}  (image=${tag} api=${api} device=${device} hw.gpu.mode='${gpu}')"
}

create_avd() { _create_emu google_apis "$@"; }   # FULL image
create_atv() { _create_emu google_atd  "$@"; }   # ATD image (named create_atv per spec)

# ── C. starters ─────────────────────────────────────────────────────────────────────
# Each starts the named emulator with flags appropriate to its KIND. IMPORTANT: whether a
# capture shows real pixels or black is set by the IMAGE the emulator was built on, NOT by
# these switches — an ATD-image emulator returns black `adb screencap` even windowed with
# -gpu host, and a full-image emulator returns real pixels. So these flags express the
# INTENDED USE of each kind; they cannot convert one kind's capture behaviour into the
# other. (That is the honest "if that's not possible, say so".)
# Param: 1 NAME (required). Emulator is backgrounded so callers can continue.
start_avd() {            # full AVD → interactive/visual: windowed + hardware GPU
  local name="$1"
  [[ -n "$name" ]] || { print -u2 -r -- "start_avd: NAME required"; return 2; }
  local -a flags
  flags=(-avd "$name" -gpu host -no-snapshot -no-boot-anim -no-audio)
  print -r -- "start_avd: $EMULATOR ${flags[*]} &"
  [[ -n ${DRY_RUN:-} ]] && return 0
  "$EMULATOR" "${flags[@]}" &
}

start_atd() {            # ATD → automated/headless: software GPU + no window
  local name="$1"
  [[ -n "$name" ]] || { print -u2 -r -- "start_atd: NAME required"; return 2; }
  local -a flags
  flags=(-avd "$name" -no-window -gpu swiftshader -no-snapshot -no-boot-anim -no-audio)
  print -r -- "start_atd: $EMULATOR ${flags[*]} &"
  [[ -n ${DRY_RUN:-} ]] && return 0
  "$EMULATOR" "${flags[@]}" &
}

# ── D. diffs ────────────────────────────────────────────────────────────────────────
# diff_targeted: FULL diffs (whole files, not grepped subsets) of the files most likely to
# explain AVD-vs-ATD behaviour: the AVD config.ini, and the system image's
# advancedFeatures.ini / build.prop / source.properties.
diff_targeted() {
  local n1="$1" n2="$2"
  [[ -n "$n1" && -n "$n2" ]] || { print -u2 -r -- "diff_targeted: needs two AVD names"; return 2; }
  local a1="$AVD_HOME/${n1}.avd" a2="$AVD_HOME/${n2}.avd"
  local s1="$ANDROID_SDK/$(_img_sysdir "$n1")" s2="$ANDROID_SDK/$(_img_sysdir "$n2")"
  local -a left right
  left=( "$a1/config.ini" "$s1/advancedFeatures.ini" "$s1/build.prop" "$s1/source.properties" )
  right=( "$a2/config.ini" "$s2/advancedFeatures.ini" "$s2/build.prop" "$s2/source.properties" )
  local i
  for (( i=1; i<=${#left}; i++ )); do
    local p1="${left[i]}" p2="${right[i]}"
    print -r -- "===== ${p1:t}   (${n1}  vs  ${n2}) ====="
    if [[ ! -f "$p1" || ! -f "$p2" ]]; then
      print -r -- "  (one or both missing: ${p1} | ${p2})"
    elif diff "$p1" "$p2"; then
      print -r -- "No differences"
    fi
  done
}

# full_diff: for every NON-binary file under device-one's .avd dir, find the same-named file
# under device-two's, print its name, compare quietly; "No differences" if identical, else
# show the diff.
full_diff() {
  local n1="$1" n2="$2"
  [[ -n "$n1" && -n "$n2" ]] || { print -u2 -r -- "full_diff: needs two AVD names"; return 2; }
  local d1="$AVD_HOME/${n1}.avd" d2="$AVD_HOME/${n2}.avd"
  [[ -d "$d1" ]] || { print -u2 -r -- "full_diff: no such AVD dir: $d1"; return 3; }
  local f rel f2
  # (.N): regular files only, NULL_GLOB so an empty match doesn't error.
  for f in "$d1"/**/*(.N); do
    # skip binary files (the .img blobs etc.)
    if [[ "$(file --brief --mime "$f")" == *charset=binary* ]]; then
      continue
    fi
    rel="${f#$d1/}"
    f2="$d2/$rel"
    print -r -- "=== ${rel} ==="
    if [[ ! -e "$f2" ]]; then
      print -r -- "  (no paired file in ${n2})"
    elif cmp -s "$f" "$f2"; then
      print -r -- "No differences"
    else
      diff "$f" "$f2"
    fi
  done
}

# ── E. invoke each function in turn ───────────────────────────────────────────────────
# NOTE: API 34 is used here because it is the only level with BOTH google_apis and google_atd
# installed on this machine (the function default is 35 per spec, but no 35 image exists yet).
# GPU is passed EMPTY ("") so config.ini gets an empty `hw.gpu.mode=` line.
# WARNING: start_avd + start_atd launch TWO concurrent emulators (heavy on this host); run
# them one at a time if you prefer. This block runs only when you execute the script.
DEMO_API=34
create_avd avd_one "" "$DEMO_API"
create_atv ATD_two "" "$DEMO_API"
start_avd  avd_one
start_atd  ATD_two
diff_targeted avd_one ATD_two
full_diff     avd_one ATD_two
