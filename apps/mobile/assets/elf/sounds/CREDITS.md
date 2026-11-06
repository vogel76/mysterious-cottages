# The elf's sounds

Every sound here is from [Freesound](https://freesound.org) under the
[Creative Commons 0](https://creativecommons.org/publicdomain/zero/1.0/)
dedication (no rights reserved, no attribution required); the authors are
named here anyway, with thanks. Each file is the sound's high-quality
preview, made mono, trimmed of its silence (40 dB under its peak), cut and
faded, levelled to one loudness and written as 44.1 kHz mono MP3 at
96 kbit/s; the fire is a 10 s stretch cross-faded into a seamless loop.
The app plays them in `src/features/elf/useElfSounds.ts`.

| File | Plays for | Sound | Author | Licence |
|---|---|---|---|---|
| `poke.mp3` | a tap on the head | [Plop!](https://freesound.org/people/Breviceps/sounds/447910/) | Breviceps | CC0 1.0 |
| `feed.mp3` | a meal | [Eating Crisps](https://freesound.org/people/WasabiWielder/sounds/334209/) | WasabiWielder | CC0 1.0 |
| `bath.mp3` | a bath | [Splash](https://freesound.org/people/swordofkings128/sounds/398032/) | swordofkings128 | CC0 1.0 |
| `play.mp3` | a game (and the twirl of a new hat) | [Throwing / Whip Effect](https://freesound.org/people/denao270/sounds/346373/) | denao270 | CC0 1.0 |
| `yawn.mp3` | a yawn | [Yawn/Yawning](https://freesound.org/people/njjjjjjjjjjjjjjjjjjjjjjjj/sounds/564231/) | njjjjjjjjjjjjjjjjjjjjjjjj | CC0 1.0 |
| `snore.mp3` | a snore with each breath of sleep | [Snoring](https://freesound.org/people/Nicolas4677/sounds/446581/) | Nicolas4677 | CC0 1.0 |
| `wake.mp3` | waking up and the greeting | [approving hm.wav](https://freesound.org/people/trimono/sounds/519112/) | trimono | CC0 1.0 |
| `crack.mp3` | each crack of the egg | [egg crack12.wav](https://freesound.org/people/Reitanna/sounds/244728/) | Reitanna | CC0 1.0 |
| `hatch.mp3` | the hatch | [cartoon_wink_magic_sparkle.wav](https://freesound.org/people/MLaudio/sounds/511485/) | MLaudio | CC0 1.0 |
| `evolve.mp3` | an evolution | [Danny Phantom Transform](https://freesound.org/people/plasterbrain/sounds/395442/) | plasterbrain | CC0 1.0 |
| `cheer.mp3` | the day's quests done, a streak's milestone | [Congrats](https://freesound.org/people/Fupicat/sounds/607207/) | Fupicat | CC0 1.0 |
| `letter.mp3` | opening a letter | [turnPage.mp3](https://freesound.org/people/partheeban/sounds/457767/) | partheeban | CC0 1.0 |
| `refuse.mp3` | a refused care (a full belly, the day's cap) | [No. Squeaky Low Voice](https://freesound.org/people/9voltfan/sounds/784922/) | 9voltfan | CC0 1.0 |
| `sip.mp3` | the sip of coffee that thanks for the player's support (the two sips and the sigh, 0.85 to 3.5 s of the preview) | [Sip of coffee, swallow then "ah"](https://freesound.org/people/odditonic/sounds/194808/) | odditonic | CC0 1.0 |
| `beckon.mp3` | the beckon towards the door | [Short Whistle](https://freesound.org/people/CressieCres/sounds/498167/) | CressieCres | CC0 1.0 |
| `fire.mp3` | the fire's crackle under the room (a 10 s loop) | [fire ambience, flames, crackles, pops, burning](https://freesound.org/people/ahriik/sounds/508110/) | ahriik | CC0 1.0 |

## The synthesised sounds

Not recorded but synthesised, so nothing to credit:
`art/sounds/synth.py` writes them as 22.05 kHz 16-bit mono WAV.

| File | Plays for | Sound |
|---|---|---|
| `echo1.wav` to `echo4.wav` | the forest echo's four tiles (`src/features/elf/games/EchoGame.tsx`) | C5, E5, G5, C6: soft bell tones on a major chord, so any order of them sounds like a tune (a sine with two quiet overtones under a fast attack and an exponential decay) |
| `echo-wrong.wav` | a wrong tile in the forest echo | a low buzz with a quick fade |
| `egg-knock.wav` | a tap on the egg | a soft wooden knock on the shell |
| `egg-warm.wav` | warming the egg | a warm hush (noise under a gentle low-pass and a slow swell) with a few ember crackles |
| `egg-lullaby.wav` | rocking the egg | a short lullaby on soft bells (sol-mi, sol-mi, la-sol) |
