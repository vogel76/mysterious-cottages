"""The elf's synthesised sounds, written as short 16-bit mono WAV files into
assets/elf/sounds (the recorded ones are CC0 previews, see CREDITS.md):

- the forest echo's notes: four warm, kalimba-like plucks low in the
  voice (C4, E4, G4, A4, a pentatonic set, so any order of them sounds
  like a tune), soft at the attack and quick to fade, so a long melody
  never grates;
- the games' sounds, shared by every board: a gentle falling "oh-oh"
  for a wrong choice, a bloop for an acorn caught, a twinkle for a star
  caught, a soft bump for a heart lost, a low rumble for a storm caught,
  a rising "ding-ding" for a right choice, a paper flick for a card
  turned, a wooden tock for a cap's hop, an arpeggio for a board
  cleared, a calm close for the end of a round and a small fanfare for
  a new record, all made of the same plucks and soft noise, so the games
  sound of one forest;
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
    """A wrong choice: two soft plucks falling a third (E4 to C4), gentle
    rather than a buzz, so a miss is told, not scolded."""
    first, second = pluck(329.63, 0.3), pluck(261.63, 0.5)
    gap = int(RATE * 0.16)
    mix = [0.0] * (gap + len(second))
    for i, value in enumerate(first):
        mix[i] += value
    for i, value in enumerate(second):
        mix[gap + i] += 0.9 * value
    return normalised(mix)


def mixed(parts: list[tuple[float, list[float], float]]) -> list[float]:
    """Sounds laid over one another: each starts at its second, at its gain."""
    length = max(int(RATE * at) + len(samples) for at, samples, _ in parts)
    mix = [0.0] * length
    for at, samples, gain in parts:
        start = int(RATE * at)
        for i, value in enumerate(samples):
            mix[start + i] += gain * value
    return normalised(mix)


def glide(start: float, end: float, seconds: float, slide: float, decay: float, second: float = 0.0) -> list[float]:
    """A soft tone whose pitch slides from start to end over slide seconds,
    under a 5 ms rise and an exponential fade, with an optional quiet
    second harmonic that lets a low tone carry on a phone's speaker."""
    samples, phase = [], 0.0
    for i in range(int(RATE * seconds)):
        t = i / RATE
        frequency = start + (end - start) * min(1.0, t / slide)
        phase += 2 * math.pi * frequency / RATE
        envelope = min(1.0, t / 0.005) * math.exp(-t * decay)
        samples.append(envelope * (math.sin(phase) + second * math.sin(2 * phase)))
    tail = int(RATE * 0.02)
    for k in range(tail):
        samples[-1 - k] *= k / tail
    return normalised(lowpass(samples, 0.3))


def noise(seconds: float, darkness: float, seed: int) -> list[float]:
    """Soft noise: white noise through two one-pole low-passes."""
    rng = random.Random(seed)
    return lowpass(lowpass([rng.random() * 2 - 1 for _ in range(int(RATE * seconds))], darkness), darkness)


def bloop() -> list[float]:
    """An acorn caught: a short round "bloop" rising from about D4 to C5."""
    return glide(300, 560, 0.2, 0.06, 18, second=0.2)


def twinkle() -> list[float]:
    """A star caught: two quick plucks rising a fourth, E5 to A5."""
    return mixed([(0.0, pluck(659.25, 0.28), 0.8), (0.07, pluck(880.0, 0.4), 0.7)])


def bump() -> list[float]:
    """A heart lost: a soft, muffled "dum" sinking from E4 a fifth down,
    high enough for a phone's small speaker to carry."""
    return glide(330, 220, 0.28, 0.12, 13, second=0.4)


def rumble(seconds: float = 0.65) -> list[float]:
    """A storm caught: a low rumble of dark noise under a sinking tone,
    swelling in and rolling away."""
    grumble = noise(seconds, 0.88, seed=5)
    samples = []
    for i, value in enumerate(grumble):
        t = i / RATE
        swell = min(1.0, t / 0.06) * math.exp(-max(0.0, t - 0.06) * 5)
        samples.append(swell * value)
    return mixed([(0.0, normalised(samples), 0.8), (0.0, glide(300, 190, seconds, 0.4, 5, second=0.5), 0.45)])


def ding_ding() -> list[float]:
    """A right choice: two short plucks rising a third, C5 to E5."""
    return mixed([(0.0, pluck(523.25, 0.25), 0.8), (0.08, pluck(659.25, 0.4), 0.8)])


def flick(seconds: float = 0.07) -> list[float]:
    """A card turned: a soft paper flick, a breath of noise over a tiny
    low pluck."""
    breath = noise(seconds, 0.6, seed=3)
    samples = [min(1.0, (i / RATE) / 0.004) * math.exp(-(i / RATE) * 60) * value for i, value in enumerate(breath)]
    return mixed([(0.0, normalised(samples), 0.6), (0.0, pluck(392.0, 0.09), 0.5)])


def tock(seconds: float = 0.12) -> list[float]:
    """A cap's hop: a light wooden tock, higher and shorter than the egg's knock."""
    rng = random.Random(9)
    samples = []
    for i in range(int(RATE * seconds)):
        t = i / RATE
        body = math.exp(-t * 48) * (math.sin(2 * math.pi * 480 * t) + 0.3 * math.sin(2 * math.pi * 1050 * t))
        click = math.exp(-t * 500) * (rng.random() * 2 - 1) * 0.3
        samples.append(min(1.0, t / 0.002) * (body + click))
    return normalised(lowpass(samples, 0.25))


def arpeggio(notes: list[float], step: float, last: float = 0.6) -> list[float]:
    """Plucks one after another, the last left to ring."""
    return mixed([(index * step, pluck(frequency, last if index == len(notes) - 1 else 0.35), 0.75) for index, frequency in enumerate(notes)])


def close() -> list[float]:
    """The end of a round: a calm close, G4 resolving to C4 and E4 together."""
    return mixed([(0.0, pluck(392.0, 0.3), 0.8), (0.17, pluck(261.63, 0.8), 0.7), (0.17, pluck(329.63, 0.8), 0.55)])


def fanfare() -> list[float]:
    """A new record: a quick climb from C4 to E5, then a chord left to ring."""
    climb = [261.63, 329.63, 392.0, 523.25, 659.25]
    parts = [(index * 0.075, pluck(frequency, 0.3), 0.7) for index, frequency in enumerate(climb)]
    at = len(climb) * 0.075 + 0.04
    parts += [(at, pluck(523.25, 1.0), 0.6), (at, pluck(659.25, 1.0), 0.5), (at, pluck(392.0, 1.0), 0.5)]
    return mixed(parts)


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


# The games' sounds and the level each is written at.
GAME_SOUNDS = {
    'game-wrong.wav': (oh_oh, 0.55),
    'game-catch.wav': (bloop, 0.7),
    'game-twinkle.wav': (twinkle, 0.6),
    'game-miss.wav': (bump, 0.75),
    'game-storm.wav': (rumble, 0.7),
    'game-right.wav': (ding_ding, 0.6),
    'game-flip.wav': (flick, 0.5),
    'game-hop.wav': (tock, 0.6),
    'game-cleared.wav': (lambda: arpeggio([261.63, 329.63, 392.0, 523.25], 0.085), 0.6),
    'game-over.wav': (close, 0.6),
    'game-record.wav': (fanfare, 0.6),
}


if __name__ == '__main__':
    for name, frequency in NOTES.items():
        write(name, pluck(frequency), volume=0.7)
    for name, (make, volume) in GAME_SOUNDS.items():
        write(name, make(), volume=volume)
    write('egg-knock.wav', knock(), volume=0.8)
    write('egg-warm.wav', hush(), volume=0.6)
    write('egg-lullaby.wav', lullaby(), volume=0.8)
    print('written', ', '.join([*NOTES, *GAME_SOUNDS, 'egg-knock.wav', 'egg-warm.wav', 'egg-lullaby.wav']), 'to', OUT)
