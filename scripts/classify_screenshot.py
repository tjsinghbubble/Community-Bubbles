#!/usr/bin/env python3
"""classify_screenshot.py — decide whether a screenshot RENDERED or came back BLACK.

The GPU sweep needs to mechanically tell "renders with valid pixels" from the all-zero
"black readback" that swiftshader's screencap produces on this host. ImageMagick/Pillow
aren't installed, so this is a stdlib-only PNG reader (zlib + manual unfilter) — same
no-deps convention as testctl.py / manage_devices.py.

Usage:
  classify_screenshot.py <file.png> [--threshold N] [--min-frac F] [--json]

A pixel is "lit" if any RGB channel > --threshold (default 8, i.e. not ~black). The
image is classified VALID if the lit fraction >= --min-frac (default 0.01 = 1%),
else BLACK. (1% guards against a stray non-zero pixel while still catching a screen
that's mostly real content.)

Exit: 0 = VALID, 10 = BLACK, 2 = error (unreadable / unsupported PNG).
Prints one line (or JSON): verdict, lit-fraction, mean, max channel value.
"""
import argparse
import json
import struct
import sys
import zlib


def _paeth(a, b, c):
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    return b if pb <= pc else c


def read_png_rgb(path):
    """Return (width, height, channels, bytes) with filters undone. 8-bit only.
    channels: 1 gray, 2 gray+alpha, 3 rgb, 4 rgba. Raises ValueError on anything odd."""
    with open(path, "rb") as f:
        data = f.read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG")
    pos = 8
    width = height = bit_depth = color_type = 0
    have_ihdr = False
    idat = bytearray()
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos:pos + 4])
        ctype = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        pos += 12 + length  # 4 len + 4 type + data + 4 crc
        if ctype == b"IHDR":
            width, height, bit_depth, color_type = struct.unpack(">IIBB", chunk[:10])
            have_ihdr = True
        elif ctype == b"IDAT":
            idat += chunk
        elif ctype == b"IEND":
            break
    if not have_ihdr:
        raise ValueError("no IHDR")
    if bit_depth != 8:
        raise ValueError(f"unsupported bit depth {bit_depth} (only 8-bit handled)")
    channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}.get(color_type)
    if channels is None:
        raise ValueError(f"unsupported color type {color_type}")
    if color_type == 3:
        raise ValueError("palette PNGs not supported (screenshots are truecolor)")
    raw = zlib.decompress(bytes(idat))
    stride = width * channels
    out = bytearray(stride * height)
    prev = bytearray(stride)
    rp = 0
    for y in range(height):
        ftype = raw[rp]; rp += 1
        line = bytearray(raw[rp:rp + stride]); rp += stride
        if ftype == 1:      # Sub
            for i in range(channels, stride):
                line[i] = (line[i] + line[i - channels]) & 0xFF
        elif ftype == 2:    # Up
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xFF
        elif ftype == 3:    # Average
            for i in range(stride):
                a = line[i - channels] if i >= channels else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 0xFF
        elif ftype == 4:    # Paeth
            for i in range(stride):
                a = line[i - channels] if i >= channels else 0
                c = prev[i - channels] if i >= channels else 0
                line[i] = (line[i] + _paeth(a, prev[i], c)) & 0xFF
        elif ftype != 0:
            raise ValueError(f"bad filter type {ftype}")
        out[y * stride:(y + 1) * stride] = line
        prev = line
    return width, height, channels, out


def classify(path, threshold, min_frac):
    w, h, ch, buf = read_png_rgb(path)
    rgb = min(ch, 3)  # ignore alpha channel for "lit"
    lit = 0
    total = w * h
    csum = 0
    cmax = 0
    for px in range(total):
        base = px * ch
        m = 0
        for k in range(rgb):
            v = buf[base + k]
            csum += v
            if v > m:
                m = v
        if m > cmax:
            cmax = m
        if m > threshold:
            lit += 1
    frac = lit / total if total else 0.0
    mean = csum / (total * rgb) if total else 0.0
    verdict = "VALID" if frac >= min_frac else "BLACK"
    return {"verdict": verdict, "lit_fraction": round(frac, 5),
            "mean_channel": round(mean, 2), "max_channel": cmax,
            "width": w, "height": h, "channels": ch}


def main():
    ap = argparse.ArgumentParser(description="classify a screenshot as VALID or BLACK")
    ap.add_argument("png")
    ap.add_argument("--threshold", type=int, default=8,
                    help="channel value above which a pixel counts as lit (default 8)")
    ap.add_argument("--min-frac", type=float, default=0.01,
                    help="lit fraction needed to call it VALID (default 0.01)")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        r = classify(args.png, args.threshold, args.min_frac)
    except (OSError, ValueError, zlib.error) as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    if args.json:
        print(json.dumps(r))
    else:
        print(f"{r['verdict']}  lit={r['lit_fraction']:.1%}  mean={r['mean_channel']}  "
              f"max={r['max_channel']}  ({r['width']}x{r['height']}, {r['channels']}ch)")
    return 0 if r["verdict"] == "VALID" else 10


if __name__ == "__main__":
    sys.exit(main())
