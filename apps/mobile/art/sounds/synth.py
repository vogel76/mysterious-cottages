"""The elf's synthesised sounds, written as short 16-bit mono WAV files into
assets/elf/sounds (the recorded ones are CC0 previews, see CREDITS.md):

- the forest echo's notes: four warm, kalimba-like plucks low in the
  voice (C4, E4, G4, A4, a pentatonic set, so any order of them sounds
  like a tune), soft at the attack and quick to fade, so a long melody
  never grates, and a gentle falling "oh-oh" for a wrong tile;
- the egg's three touches, each its own sound: a soft wooden knock for a
  tap on the shell, a warm hush with a few ember crackles for the warming,
  and a short lullaby for the rocking.

A bell tone is a sine with two quiet overtones under a fast attack and an
exponential decay, so it rings like a small marimba bar rather than
beeping; the hush is noise through a gentle low-pass under a slow swell.
Run from apps/mobile:

    python3 art/sounds/synth.py
"""

from __future__ import annotations

import math
import random
import struct
import wave
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / 'assets' / 'elf' / 'sounds'
RATE = 22050

NOTES = {
    'echo1.wav': 261.63,  # C4
    'echo2.wav': 329.63,  # E4
    'echo3.wav': 392.00,  # G4
    'echo4.wav': 440.00,  # A4
}

# The lullaby: sol-mi, sol-mi, la-sol, as a mother hums it.
LULLABY = [(392.00, 0.0), (329.63, 0.26), (392.00, 0.52), (329.63, 0.78), (440.00, 1.06), (392.00, 1.34)]


def normalised(samples: list[float]) -> list[float]:
    peak = max(abs(s) for s in samples) or 1.0
    return [s / peak for s in samples]


def tone(frequency: float, seconds: float, overtones: tuple[float, ...], decay: float, attack: float = 0.006) -> list[float]:
    samples = []
    for i in range(int(RATE * seconds)):
        t = i / RATE
        envelope = min(1.0, t / attack) * math.exp(-t * decay)
        value = math.sin(2 * math.pi * frequency * t)
        for n, gain in enumerate(overtones, start=2):
            value += gain * math.sin(2 * math.pi * frequency * n * t)
        samples.append(envelope * value)
    return normalised(samples)


def lowpass(samples: list[float], amount: float) -> list[float]:
    """A one-pole low-pass: the higher the amount, the darker."""
    out, low = [], 0.0
    for value in samples:
        low += (1 - amount) * (value - low)
        out.append(low)
    return out


def pluck(frequency: float, seconds: float = 0.45) -> list[float]:
    """A warm kalimba-like pluck: the fundamental with a quiet octave that
    fades first, a soft 15 ms rise (no click), a fade of under half a
    second, and a gentle low-pass that keeps the top dark."""
    samples = []
    for i in range(int(RATE * seconds)):
        t = i / RATE
        rise = min(1.0, t / 0.015)
        body = math.exp(-t * 7.5) * math.sin(2 * math.pi * frequency * t)
        octave = 0.18 * math.exp(-t * 16) * math.sin(2 * math.pi * 2 * frequency * t)
        samples.append(rise * (body + octave))
    tail = int(RATE * 0.03)
    for k in range(tail):
        samples[-1 - k] *= k / tail
    return normalised(lowpass(samples, 0.35))


def oh_oh() -> list[float]:
    """A wrong tile: two soft plucks falling a third (E4 to C4), gentle
    rather than a buzz, so a miss is told, not scolded."""
    first, second = pluck(329.63, 0.3), pluck(261.63, 0.5)
    gap = int(RATE * 0.16)
    mix = [0.0] * (gap + len(second))
    for i, value in enumerate(first):
        mix[i] += value
    for i, value in enumerate(second):
        mix[gap + i] += 0.9 * value
    return normalised(mix)


def knock(seconds: float = 0.18) -> list[float]:
    """A soft wooden knock on the shell: a low ringing body under a short click."""
    rng = random.Random(7)
    samples = []
    for i in range(int(RATE * seconds)):
        t = i / RATE
        body = math.exp(-t * 38) * (math.sin(2 * math.pi * 310 * t) + 0.4 * math.sin(2 * math.pi * 720 * t))
        click = math.exp(-t * 400) * (rng.random() * 2 - 1) * 0.6
        samples.append(min(1.0, t / 0.002) * (body + click))
    return normalised(samples)


def hush(seconds: float = 1.6) -> list[float]:
    """The warming: noise through a one-pole low-pass under a slow swell,
    with a few ember crackles in it."""
    rng = random.Random(11)
    samples, low = [], 0.0
    crackles = sorted(rng.uniform(0.25, seconds - 0.3) for _ in range(5))
    for i in range(int(RATE * seconds)):
        t = i / RATE
        low += 0.06 * ((rng.random() * 2 - 1) - low)
        swell = math.sin(math.pi * min(1.0, t / seconds)) ** 1.5
        value = 2.4 * low * swell
        for at in crackles:
            if 0 <= t - at < 0.012:
                value += 0.5 * math.exp(-(t - at) * 500) * (rng.random() * 2 - 1)
        samples.append(value)
    return normalised(samples)


def lullaby() -> list[float]:
    """The rocking: the lullaby's six notes on soft bells, overlapping as they ring."""
    length = LULLABY[-1][1] + 0.7
    mix = [0.0] * int(RATE * length)
    for frequency, at in LULLABY:
        note = tone(frequency, 0.7, (0.25, 0.08), decay=4.0, attack=0.012)
        start = int(RATE * at)
        for i, value in enumerate(note):
            if start + i < len(mix):
                mix[start + i] += 0.7 * value
    return normalised(mix)


def write(name: str, samples: list[float], volume: float) -> None:
    with wave.open(str(OUT / name), 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(b''.join(struct.pack('<h', int(volume * s * 32767)) for s in samples))


if __name__ == '__main__':
    for name, frequency in NOTES.items():
        write(name, pluck(frequency), volume=0.7)
    write('echo-wrong.wav', oh_oh(), volume=0.55)
    write('egg-knock.wav', knock(), volume=0.8)
    write('egg-warm.wav', hush(), volume=0.6)
    write('egg-lullaby.wav', lullaby(), volume=0.8)
    print('written', ', '.join([*NOTES, 'echo-wrong.wav', 'egg-knock.wav', 'egg-warm.wav', 'egg-lullaby.wav']), 'to', OUT)
