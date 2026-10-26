#!/usr/bin/env python3
"""Drives the app on a device from the shell, for repeatable walkthroughs:
reads the view hierarchy, presses a control by its visible text or its
accessibility label, takes screenshots, launches the app.

    python3 tools/ui.py [--serial S] launch [--metro HOST:PORT]   start the app (a dev client opens the Metro URL)
    python3 tools/ui.py dump                                      every text and label on screen with its centre
    python3 tools/ui.py find "Elf"                                the centre of the first match (text or label)
    python3 tools/ui.py tap "Elf"                                 press it (an 80 ms press: a zero-length tap loses
                                                                  the race against the scene's pan gesture)
    python3 tools/ui.py tapxy 540 1300                            press a point
    python3 tools/ui.py shot NAME [--out DIR]                     screenshot to DIR/NAME.png

Matching is by substring, case-insensitive, text first, then the
accessibility label (content description), so a control is found by the
words the dictionary gives it in the device's language. Things learned the
hard way: never send the BACK key on a tab screen (the navigator jumps to
the first tab), the dev client shows its first-launch notice after every
force-stop ("Continue", then "Close"), and the first care button sometimes
ignores a press shorter than about 80 ms."""

from __future__ import annotations

import argparse
import os
import re
import sys
import xml.etree.ElementTree as ET

from adbkit import adb, app_package, pick_serial, shell


def nodes(serial: str):
    shell(serial, 'uiautomator dump /sdcard/ui.xml')
    xml = adb(serial, 'exec-out', 'cat', '/sdcard/ui.xml')
    for node in ET.fromstring(xml).iter('node'):
        numbers = re.findall(r'\d+', node.get('bounds') or '')
        if len(numbers) == 4:
            yield node, tuple(map(int, numbers))


def find(serial: str, needle: str):
    needle = needle.lower()
    for node, bounds in nodes(serial):
        if needle in (node.get('text') or '').lower() or needle in (node.get('content-desc') or '').lower():
            return node, bounds
    return None, None


def centre(bounds):
    return (bounds[0] + bounds[2]) // 2, (bounds[1] + bounds[3]) // 2


def press(serial: str, x: int, y: int, ms: int = 80) -> None:
    shell(serial, f'input swipe {x} {y} {x} {y} {ms}')


def main(argv: list[str]) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--serial')
    sub = parser.add_subparsers(dest='command', required=True)
    launch = sub.add_parser('launch')
    launch.add_argument('--metro', help='HOST:PORT of a running Metro, for a development client')
    sub.add_parser('dump')
    sub.add_parser('find').add_argument('needle')
    sub.add_parser('tap').add_argument('needle')
    tapxy = sub.add_parser('tapxy')
    tapxy.add_argument('x', type=int)
    tapxy.add_argument('y', type=int)
    shot = sub.add_parser('shot')
    shot.add_argument('name')
    shot.add_argument('--out', default='.')
    args = parser.parse_args(argv)
    serial = pick_serial(args.serial)
    package = app_package()

    if args.command == 'launch':
        if args.metro:
            url = f'chatynkowo://expo-development-client/?url=http%3A%2F%2F{args.metro.replace(":", "%3A")}'
            shell(serial, f'am start -n {package}/.MainActivity -a android.intent.action.VIEW -d "{url}"')
        else:
            shell(serial, f'monkey -p {package} -c android.intent.category.LAUNCHER 1')
    elif args.command == 'dump':
        for node, bounds in nodes(serial):
            text, label = node.get('text') or '', node.get('content-desc') or ''
            if text or label:
                print(f'{centre(bounds)} {node.get("class", "").split(".")[-1]} text={text!r} label={label!r}')
    elif args.command == 'find':
        _, bounds = find(serial, args.needle)
        print(centre(bounds) if bounds else 'NOT FOUND')
    elif args.command == 'tap':
        _, bounds = find(serial, args.needle)
        if not bounds:
            sys.exit(f'ui: nothing on screen matches {args.needle!r}')
        x, y = centre(bounds)
        press(serial, x, y)
        print(f'pressed {args.needle!r} at {(x, y)}')
    elif args.command == 'tapxy':
        press(serial, args.x, args.y)
    elif args.command == 'shot':
        os.makedirs(args.out, exist_ok=True)
        path = os.path.join(args.out, f'{args.name}.png')
        with open(path, 'wb') as handle:
            handle.write(adb(serial, 'exec-out', 'screencap', '-p', binary=True))
        print(path)


if __name__ == '__main__':
    main(sys.argv[1:])
