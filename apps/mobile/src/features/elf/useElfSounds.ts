import { useCallback, useEffect, useRef } from 'react'
import { createAudioPlayer, type AudioPlayer } from 'expo-audio'
import { enterAudioSession } from '../../lib/audio'
import { useSoundPrefs } from '../../lib/sounds-store'

/* The elf's sounds: a short sound for what happens to the elf (a tap on
   its head, a meal, a bath, a game, a yawn, a snore in its sleep, waking
   up, the egg's cracks and its hatch, an evolution, a cheer, a letter;
   a pat is silent, it comes too often), never for a tap on the chrome,
   and the fire's crackle under the room while it is in view. Every sound is CC0 (assets/elf/sounds/CREDITS.md). The
   players exist only while the tab is in view and the player wants the
   sounds (the preferences' switch); they are created on a first play and
   released when the tab leaves. The session is the effects' one
   (src/lib/audio.ts): the sounds mix with what else plays, never take the
   audio focus and keep quiet while the phone is on silent or vibrate. A
   sound that plays again too soon (taps in a row) is let go. */

export type ElfSound = 'poke' | 'feed' | 'bath' | 'play' | 'yawn' | 'snore' | 'wake' | 'crack' | 'hatch' | 'evolve' | 'cheer' | 'letter'

type SoundSpec = { module: number; volume: number; minGapMs: number }

const SOUNDS: Record<ElfSound, SoundSpec> = {
  poke: { module: require('../../../assets/elf/sounds/poke.mp3'), volume: 0.6, minGapMs: 400 },
  feed: { module: require('../../../assets/elf/sounds/feed.mp3'), volume: 0.8, minGapMs: 800 },
  bath: { module: require('../../../assets/elf/sounds/bath.mp3'), volume: 0.7, minGapMs: 800 },
  play: { module: require('../../../assets/elf/sounds/play.mp3'), volume: 0.7, minGapMs: 800 },
  yawn: { module: require('../../../assets/elf/sounds/yawn.mp3'), volume: 0.6, minGapMs: 2000 },
  snore: { module: require('../../../assets/elf/sounds/snore.mp3'), volume: 0.35, minGapMs: 2500 },
  wake: { module: require('../../../assets/elf/sounds/wake.mp3'), volume: 0.6, minGapMs: 800 },
  crack: { module: require('../../../assets/elf/sounds/crack.mp3'), volume: 0.8, minGapMs: 300 },
  hatch: { module: require('../../../assets/elf/sounds/hatch.mp3'), volume: 0.8, minGapMs: 1000 },
  evolve: { module: require('../../../assets/elf/sounds/evolve.mp3'), volume: 0.8, minGapMs: 1000 },
  cheer: { module: require('../../../assets/elf/sounds/cheer.mp3'), volume: 0.7, minGapMs: 1000 },
  letter: { module: require('../../../assets/elf/sounds/letter.mp3'), volume: 0.7, minGapMs: 600 },
}

const FIRE = { module: require('../../../assets/elf/sounds/fire.mp3'), volume: 0.18 }

/* A player is paused before it is removed: on Android, expo-audio's
   remove() releases the object but a player still playing (the fire's
   loop) keeps sounding until it is collected, so a tab left and entered
   again would stack a second crackle on the first. */
function release(player: AudioPlayer) {
  try {
    player.pause()
  } catch {
    // Already released.
  }
  player.remove()
}

/* Plays the elf's sounds while `inView` (the tab focused) and the player
   wants them; the fire crackles under the room meanwhile. */
export function useElfSounds(inView: boolean): (sound: ElfSound) => void {
  const { enabled } = useSoundPrefs()
  const on = inView && enabled
  const players = useRef(new Map<ElfSound, AudioPlayer>())
  const lastPlayed = useRef(new Map<ElfSound, number>())
  /* Read when a session comes through, which can be after the tab left. */
  const onRef = useRef(on)
  onRef.current = on

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
    const pool = players.current
    return () => {
      cancelled = true
      if (fire) release(fire)
      fire = null
      pool.forEach(release)
      pool.clear()
    }
  }, [on])

  return useCallback(
    (sound: ElfSound) => {
      if (!on) return
      const spec = SOUNDS[sound]
      const now = Date.now()
      if (now - (lastPlayed.current.get(sound) ?? 0) < spec.minGapMs) return
      lastPlayed.current.set(sound, now)
      void enterAudioSession('effects').then(() => {
        if (!onRef.current) return
        let player = players.current.get(sound)
        if (!player) {
          player = createAudioPlayer(spec.module)
          player.volume = spec.volume
          players.current.set(sound, player)
        }
        void player.seekTo(0).then(() => player.play())
      })
    },
    [on],
  )
}
