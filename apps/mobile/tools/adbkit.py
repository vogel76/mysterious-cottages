"""What the measuring tools share: the app's package id from app.json, the
device to talk to, adb calls, and the memory figures Android reports.

Every tool here runs with the system Python 3 and the adb on the PATH
(Android Studio's platform-tools). The device is the one `--serial` names,
else the SERIAL environment variable, else the only device attached;
wireless debugging shows up as `adb-<id>._adb-tls-connect._tcp`. Nothing
here needs the dev client or Metro: a release build is measured the same
way, which is the point (see "Measuring the elf" in the mobile README)."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)


def app_package() -> str:
    """The Android application id, as app.json declares it."""
    with open(os.path.join(APP, 'app.json'), encoding='utf-8') as handle:
        return json.load(handle)['expo']['android']['package']


def devices() -> list[str]:
    out = subprocess.run(['adb', 'devices'], capture_output=True, text=True).stdout
    return [line.split()[0] for line in out.splitlines()[1:] if len(line.split()) >= 2 and line.split()[1] == 'device']


def pick_serial(preferred: str | None = None) -> str:
    serial = preferred or os.environ.get('SERIAL')
    if serial:
        return serial
    attached = devices()
    if len(attached) == 1:
        return attached[0]
    if not attached:
        sys.exit('adbkit: no device attached (enable wireless debugging or plug the phone in)')
    sys.exit(f'adbkit: several devices attached, pick one with --serial or SERIAL: {", ".join(attached)}')


def adb(serial: str, *args: str, binary: bool = False) -> str | bytes:
    """One adb call against the device; stdout as text (or bytes)."""
    result = subprocess.run(['adb', '-s', serial, *args], capture_output=True)
    if result.returncode != 0:
        sys.exit(f'adbkit: adb {" ".join(args)} failed: {result.stderr.decode("utf-8", "replace").strip()}')
    return result.stdout if binary else result.stdout.decode('utf-8', 'replace')


def shell(serial: str, command: str) -> str:
    return adb(serial, 'shell', command)


def pid_of(serial: str, package: str) -> int | None:
    out = shell(serial, f'pidof {package}').strip()
    return int(out.split()[0]) if out else None


MEM_ROWS = {
    'pss': re.compile(r'TOTAL PSS:\s+(\d+)'),
    'rss': re.compile(r'TOTAL RSS:\s+(\d+)'),
    'native': re.compile(r'Native Heap\s+(\d+)'),
    'dalvik': re.compile(r'Dalvik Heap\s+(\d+)'),
    'graphics': re.compile(r'^\s+Graphics:\s+(\d+)', re.M),
    'gl': re.compile(r'GL mtrack\s+(\d+)'),
    'egl': re.compile(r'EGL mtrack\s+(\d+)'),
    'unknown': re.compile(r'^\s+Unknown\s+(\d+)', re.M),
}


def meminfo(serial: str, package: str) -> dict[str, int]:
    """The app's memory in MB from `dumpsys meminfo`: PSS, RSS, the native and
    Dalvik heaps, the graphics total with its GL and EGL parts (the GPU's
    copies of the textures, which Skia never gives back), and 'Unknown'
    (mostly Hermes). Zeros when the process is not running."""
    out = shell(serial, f'dumpsys meminfo {package}')
    figures = {}
    for key, pattern in MEM_ROWS.items():
        match = pattern.search(out)
        figures[key] = round(int(match.group(1)) / 1024) if match else 0
    return figures


def surface_layer(serial: str, package: str) -> str | None:
    """The SurfaceView layer of the app's activity: where Skia draws the cottage."""
    out = shell(serial, 'dumpsys SurfaceFlinger --list')
    layers = [line.strip() for line in out.splitlines() if package in line and 'SurfaceView' in line and 'Background' not in line]
    blast = [layer for layer in layers if '(BLAST)' in layer]
    return (blast or layers or [None])[0]
