#!/usr/bin/env python3
"""Samples the app's memory on a device and prints a table, one row per
sample, so a before-and-after of the elf's cost is a matter of reading
two rows.

    python3 tools/memtable.py [--serial S] [--label TEXT] [--every 60] [--count 1]

Columns, in MB from `dumpsys meminfo`: PSS (the total the system counts
against the app), the native heap (Skia's decoded sheets and images live
here), the graphics total with its GL and EGL parts (the GPU's copies of
the textures and the surfaces; Skia keeps a drawn texture until its
budget is hit, so this part only grows), the Dalvik heap, 'Unknown'
(mostly Hermes) and the RSS. Measure a release build after a fresh
install, in the series the README describes (the Atlas alone, the Elf tab
just entered, after every clip has played, back on the Atlas), and label
the rows so the table reads itself."""

from __future__ import annotations

import argparse
import sys
import time
from datetime import datetime

from adbkit import app_package, meminfo, pick_serial, pid_of

COLUMNS = ['pss', 'native', 'graphics', 'gl', 'egl', 'dalvik', 'unknown', 'rss']


def main(argv: list[str]) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--serial')
    parser.add_argument('--label', default='')
    parser.add_argument('--every', type=float, default=60, help='seconds between samples')
    parser.add_argument('--count', type=int, default=1)
    parser.add_argument('--no-header', action='store_true')
    args = parser.parse_args(argv)
    serial = pick_serial(args.serial)
    package = app_package()

    if not args.no_header:
        print('time      label              ' + ' '.join(f'{name:>8}' for name in COLUMNS) + '   (MB)')
    for index in range(args.count):
        if pid_of(serial, package) is None:
            sys.exit(f'memtable: {package} is not running')
        figures = meminfo(serial, package)
        stamp = datetime.now().strftime('%H:%M:%S')
        print(f'{stamp}  {args.label[:18]:<18} ' + ' '.join(f'{figures[name]:>8}' for name in COLUMNS), flush=True)
        if index + 1 < args.count:
            time.sleep(args.every)


if __name__ == '__main__':
    main(sys.argv[1:])
