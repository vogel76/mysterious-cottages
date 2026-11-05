"""The forest echo's notes, synthesised: four soft bell-like tones on a
major chord (C5, E5, G5, C6: any order of them sounds like a tune) and
the low buzz of a wrong tile, written as short 16-bit mono WAV files into
assets/elf/sounds. Each tone is a sine with two quiet overtones under a
fast attack and an exponential decay, so it rings like a small marimba
bar rather than beeping. Run from apps/mobile:

    python3 art/sounds/echo_notes.py
"""

from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / 'assets' / 'elf' / 'sounds'
RATE = 22050

NOTES = {
    'echo1.wav': 523.25,  # C5
    'echo2.wav': 659.25,  # E5
    'echo3.wav': 783.99,  # G5
    'echo4.wav': 1046.50,  # C6
}


def tone(frequency: float, seconds: float, overtones: tuple[float, ...], decay: float, attack: float = 0.006) -> list[float]:
    samples = []
    count = int(RATE * seconds)
    for i in range(count):
        t = i / RATE
        envelope = min(1.0, t / attack) * math.exp(-t * decay)
        value = math.sin(2 * math.pi * frequency * t)
        for n, gain in enumerate(overtones, start=2):
            value += gain * math.sin(2 * math.pi * frequency * n * t)
        samples.append(envelope * value)
    peak = max(abs(s) for s in samples) or 1.0
    return [s / peak for s in samples]


def buzz(seconds: float) -> list[float]:
    """A low, slightly rough buzz: a square-ish wave with a quick fade."""
    samples = []
    count = int(RATE * seconds)
    for i in range(count):
        t = i / RATE
        envelope = min(1.0, t / 0.004) * math.exp(-t * 9)
        value = math.sin(2 * math.pi * 150 * t) + 0.5 * math.sin(2 * math.pi * 300 * t) + 0.25 * math.sin(2 * math.pi * 450 * t)
        samples.append(envelope * max(-0.8, min(0.8, value)))
    peak = max(abs(s) for s in samples) or 1.0
    return [s / peak for s in samples]


def write(name: str, samples: list[float], volume: float) -> None:
    with wave.open(str(OUT / name), 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(b''.join(struct.pack('<h', int(volume * s * 32767)) for s in samples))


if __name__ == '__main__':
    for name, frequency in NOTES.items():
        write(name, tone(frequency, 0.5, (0.35, 0.12), decay=5.5), volume=0.85)
    write('echo-wrong.wav', buzz(0.3), volume=0.7)
    print('written', ', '.join([*NOTES, 'echo-wrong.wav']), 'to', OUT)
