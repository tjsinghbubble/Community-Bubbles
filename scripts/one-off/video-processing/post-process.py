#!/usr/bin/env python3
"""Condense + annotate a Maestro Android test-run screen recording.

Input : a raw MP4 screen recording plus the Maestro flow-details JSON.
Output: a shorter MP4 where static stretches are dropped (ffmpeg mpdecimate)
        and every test step is labelled on-screen — green=completed,
        red=failed, white=other.

Timeline sync: the app-restart "white frame" near the recording start is used
as a fixed anchor. Its video timestamp is mapped to the first step's epoch so
step epochs from the JSON can be projected onto video seconds.

Standalone one-off (see ../README.md): nothing imports this. Requires ffmpeg +
ffprobe on PATH; pure Python 3 stdlib otherwise. Tune by editing the DEFAULT_*
constants below or via the CLI flags.

Usage:
    python3 post-process.py [--video IN.mp4] [--json FLOW.json]
                            [--out OUT.mp4] [--white-yavg 230]
"""

import argparse
import json
import re
import subprocess

# --- Editable defaults (each overridable on the CLI) ------------------------
DEFAULT_VIDEO_INPUT = "input.mp4"
DEFAULT_JSON_INPUT = "maestro-flow-details-flow.json"
DEFAULT_VIDEO_OUTPUT = "condensed_annotated_output.mp4"
DEFAULT_WHITE_YAVG = 230.0  # avg luminance (0-255) above which a frame is "white"

# Chars ffmpeg drawtext tolerates unescaped; everything else is stripped.
_SAFE_TEXT = re.compile(r"[^a-zA-Z0-9_\-\s\.]")


def find_white_frame_seconds(video_path, yavg_threshold):
    """Return video-seconds of the first near-white frame, else 0.0.

    Reads per-frame average luminance (YAVG) via ffprobe+signalstats and
    returns the timestamp of the first frame brighter than ``yavg_threshold``
    — the app-restart flash used as the sync anchor.
    """
    cmd = [
        "ffprobe", "-v", "error", "-f", "lavfi",
        f"movie={video_path},signalstats",
        "-show_entries", "frame=pts_time:frame_tags=lavfi.signalstats.YAVG",
        "-of", "csv=p=0",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)

    for line in result.stdout.splitlines():
        parts = line.split(",")
        if len(parts) < 2:
            continue
        time_s, yavg = parts[0], parts[-1]  # first + last guards extra columns
        try:
            if float(yavg) > yavg_threshold:
                return float(time_s)
        except ValueError:
            continue  # header / blank / non-numeric row
    return 0.0  # fallback: no marker found, treat recording start as anchor


def load_steps(json_path):
    """Return the list of Maestro steps from ``json_path`` (may be empty)."""
    with open(json_path, "r") as f:
        flow_data = json.load(f)
    return flow_data.get("steps", flow_data.get("commands", []))


def video_start_epoch_ms(steps, marker_seconds):
    """Epoch-ms that the video's t=0 corresponds to.

    Anchors the first step's epoch to where the white marker appears in the
    video, so any step epoch can be projected onto video seconds.
    """
    first_step_epoch = steps[0]["metadata"]["timestamp"]
    return first_step_epoch - (marker_seconds * 1000)


def _step_color(status):
    """Map a step status to a drawtext font colour."""
    if status == "COMPLETED":
        return "green"
    if status == "FAILED":
        return "red"
    return "white"


def build_step_filter(step, start_epoch_ms):
    """Build one ffmpeg ``drawtext`` clause overlaying a step for its interval.

    Projects the step's epoch/duration onto video seconds and enables the
    label only ``between`` those seconds.
    """
    text = _SAFE_TEXT.sub("", step.get("command", "Unknown Step"))
    meta = step["metadata"]
    status = meta.get("status", "UNKNOWN")
    seq = step.get("sequenceNumber", 0)

    start_sec = (meta["timestamp"] - start_epoch_ms) / 1000.0
    end_sec = start_sec + meta["duration"] / 1000.0

    label = f"[{seq}] {text} ({status})"
    return (
        f"drawtext=text='{label}':enable='between(t,{start_sec},{end_sec})':"
        f"x=20:y=20:fontsize=24:fontcolor={_step_color(status)}:"
        f"box=1:boxcolor=black@0.6"
    )


def build_filter_chain(steps, start_epoch_ms):
    """Compose the full ``-vf`` chain: per-step overlays, then condense.

    ``mpdecimate`` drops near-duplicate (static) frames and ``setpts`` re-times
    the survivors so playback is continuous. Annotations are baked first so
    their timing tracks the ORIGINAL timeline before frames are dropped.
    """
    overlays = [build_step_filter(s, start_epoch_ms) for s in steps]
    return ",".join(overlays) + ",mpdecimate,setpts=N/FRAME_RATE/TB"


def run_ffmpeg(video_input, video_output, video_filter):
    """Run ffmpeg to write the condensed, annotated video (audio dropped)."""
    cmd = [
        "ffmpeg", "-y",
        "-i", video_input,
        "-vf", video_filter,
        "-an",  # drop the noisy test-environment audio
        video_output,
    ]
    print("Executing video transformation via FFmpeg...")
    subprocess.run(cmd)
    print(f"Done! Saved to {video_output}")


def parse_args():
    """Parse CLI overrides for the DEFAULT_* constants."""
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--video", default=DEFAULT_VIDEO_INPUT, help="input MP4")
    p.add_argument("--json", default=DEFAULT_JSON_INPUT, help="Maestro flow JSON")
    p.add_argument("--out", default=DEFAULT_VIDEO_OUTPUT, help="output MP4")
    p.add_argument("--white-yavg", type=float, default=DEFAULT_WHITE_YAVG,
                   help="luminance (0-255) treated as a white anchor frame")
    return p.parse_args()


def main():
    """Wire the pipeline: locate anchor, sync timelines, annotate, condense."""
    args = parse_args()

    steps = load_steps(args.json)
    if not steps:
        print("No steps found in JSON.")
        return

    marker_seconds = find_white_frame_seconds(args.video, args.white_yavg)
    start_epoch_ms = video_start_epoch_ms(steps, marker_seconds)
    video_filter = build_filter_chain(steps, start_epoch_ms)
    run_ffmpeg(args.video, args.out, video_filter)


if __name__ == "__main__":
    main()
