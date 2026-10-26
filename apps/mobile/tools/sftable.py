#!/usr/bin/env python3
"""Measures the frames the cottage really presents, from SurfaceFlinger,
over a window of seconds.

    python3 tools/sftable.py [--serial S] [--seconds 8] [--label TEXT]

Skia draws the cottage on its own SurfaceView, which `dumpsys gfxinfo`
(the usual frame-time tool) does not see at all: it reports the React
Native views, which barely redraw while the scene runs at 60 fps. So this
tool turns SurfaceFlinger's per-layer statistics on, waits, and reads the
SurfaceView layer of the app: the frames presented, the frames dropped
and the average rate. Run it with the Elf tab in front and the elf awake
(the idle loop), then during a reaction, then while a panel is open; a
dropped frame or a rate under the display's shows up here first. The
'present to present' histogram the dump also prints is left out: the
three numbers answer the question. Works on Android 12 and later; older
devices lack the timestats command."""

from __future__ import annotations

import argparse
import re
import sys
import time

from adbkit import app_package, pick_serial, shell, surface_layer


def stats_for(dump: str, layer: str) -> dict[str, float] | None:
    """The block of the layer in `--timestats -dump`."""
    marker = f'layerName = {layer}'
    start = dump.find(marker)
    if start < 0:
        return None
    block = dump[start:start + 2000]
    figures = {}
    for key, pattern in (('frames', r'totalFrames = (\d+)'), ('dropped', r'droppedFrames = (\d+)'), ('fps', r'averageFPS = ([\d.]+)')):
        match = re.search(pattern, block)
        if match:
            figures[key] = float(match.group(1))
    return figures or None


def main(argv: list[str]) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--serial')
    parser.add_argument('--seconds', type=float, default=8)
    parser.add_argument('--label', default='')
    args = parser.parse_args(argv)
    serial = pick_serial(args.serial)
    package = app_package()

    layer = surface_layer(serial, package)
    if not layer:
        sys.exit(f'sftable: {package} has no SurfaceView layer on screen (open the Elf tab first)')
    shell(serial, 'dumpsys SurfaceFlinger --timestats -clear')
    shell(serial, 'dumpsys SurfaceFlinger --timestats -enable')
    time.sleep(args.seconds)
    dump = shell(serial, 'dumpsys SurfaceFlinger --timestats -dump')
    shell(serial, 'dumpsys SurfaceFlinger --timestats -disable')
    figures = stats_for(dump, layer)
    if not figures:
        sys.exit('sftable: SurfaceFlinger reported nothing for the layer (did the scene draw during the window?)')
    frames, dropped, fps = int(figures.get('frames', 0)), int(figures.get('dropped', 0)), figures.get('fps', 0.0)
    print(f'{args.label[:18]:<18} {args.seconds:>5.1f} s  frames {frames:>5}  dropped {dropped:>3}  average {fps:5.1f} fps')


if __name__ == '__main__':
    main(sys.argv[1:])
