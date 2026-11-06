import { useEffect } from 'react'
import { createAudioPlayer, type AudioPlayer } from 'expo-audio'
import { enterAudioSession } from '../../lib/audio'
import { releasePlayer, useSoundPool, useSoundsOn, type SoundSpec } from '../../lib/sound-pool'

/* The elf's sounds: a short sound for what happens to the elf (a tap on
   its head, a meal, a bath, a game, a yawn, a snore in its sleep, waking
   up, the egg's knock, its warming and its lullaby, its cracks and its
   hatch, an evolution, a cheer, a letter,
   a refused care, the sip that thanks for a coffee, a beckon;
   a pat is silent, it comes too often), never for a tap on the chrome,
   and the fire's crackle under the room while it is in view. Every sound
   is CC0 or synthesised (assets/elf/sounds/CREDITS.md). The sounds are a pool
   (src/lib/sound-pool.ts): players that exist only while the tab is in
   view and the player wants them, on the effects' audio session; the
   fire's loop is kept here beside the pool. */

export type ElfSound = 'poke' | 'feed' | 'bath' | 'play' | 'yawn' | 'snore' | 'wake' | 'eggTap' | 'warm' | 'lullaby' | 'crack' | 'hatch' | 'evolve' | 'cheer' | 'letter' | 'refuse' | 'sip' | 'beckon'

const SOUNDS: Record<ElfSound, SoundSpec> = {
  poke: { module: require('../../../assets/elf/sounds/poke.mp3'), volume: 0.6, minGapMs: 400 },
  feed: { module: require('../../../assets/elf/sounds/feed.mp3'), volume: 0.8, minGapMs: 800 },
  bath: { module: require('../../../assets/elf/sounds/bath.mp3'), volume: 0.7, minGapMs: 800 },
  play: { module: require('../../../assets/elf/sounds/play.mp3'), volume: 0.7, minGapMs: 800 },
  yawn: { module: require('../../../assets/elf/sounds/yawn.mp3'), volume: 0.6, minGapMs: 2000 },
  snore: { module: require('../../../assets/elf/sounds/snore.mp3'), volume: 0.35, minGapMs: 2500 },
  wake: { module: require('../../../assets/elf/sounds/wake.mp3'), volume: 0.6, minGapMs: 800 },
  eggTap: { module: require('../../../assets/elf/sounds/egg-knock.wav'), volume: 0.7, minGapMs: 250 },
  warm: { module: require('../../../assets/elf/sounds/egg-warm.wav'), volume: 0.6, minGapMs: 1200 },
  lullaby: { module: require('../../../assets/elf/sounds/egg-lullaby.wav'), volume: 0.7, minGapMs: 1600 },
  crack: { module: require('../../../assets/elf/sounds/crack.mp3'), volume: 0.8, minGapMs: 300 },
  hatch: { module: require('../../../assets/elf/sounds/hatch.mp3'), volume: 0.8, minGapMs: 1000 },
  evolve: { module: require('../../../assets/elf/sounds/evolve.mp3'), volume: 0.8, minGapMs: 1000 },
  cheer: { module: require('../../../assets/elf/sounds/cheer.mp3'), volume: 0.7, minGapMs: 1000 },
  refuse: { module: require('../../../assets/elf/sounds/refuse.mp3'), volume: 0.6, minGapMs: 800 },
  sip: { module: require('../../../assets/elf/sounds/sip.mp3'), volume: 0.7, minGapMs: 2000 },
  beckon: { module: require('../../../assets/elf/sounds/beckon.mp3'), volume: 0.5, minGapMs: 1500 },
  letter: { module: require('../../../assets/elf/sounds/letter.mp3'), volume: 0.7, minGapMs: 600 },
}

const FIRE = { module: require('../../../assets/elf/sounds/fire.mp3'), volume: 0.18 }

/* Plays the elf's sounds while `inView` (the tab focused) and the player
   wants them; the fire crackles under the room meanwhile. */
export function useElfSounds(inView: boolean): (sound: ElfSound) => void {
  const on = useSoundsOn(inView)
  useEffect(() => {
    if (!on) return
    let cancelled = false
    let fire: AudioPlayer | null = null
    void enterAudioSession('effects').then(() => {
      if (cancelled) return
      fire = createAudioPlayer(FIRE.module)
      fire.loop = true
      fire.volume = FIRE.volume
      fire.play()
    })
    return () => {
      cancelled = true
      if (fire) releasePlayer(fire)
      fire = null
    }
  }, [on])
  return useSoundPool(SOUNDS, inView)
}
