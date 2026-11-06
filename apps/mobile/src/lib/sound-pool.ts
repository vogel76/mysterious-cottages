import { useCallback, useEffect, useRef } from 'react'
import { createAudioPlayer, type AudioPlayer } from 'expo-audio'
import { enterAudioSession } from './audio'
import { useSoundPrefs } from './sounds-store'

/* A pool of short sounds for a screen: each is a bundled file with its
   volume and the shortest gap between two plays of it (taps in a row
   are let go). The players exist only while the screen is in view and
   the player wants the sounds (the preferences' switch); they are
   created on a first play and released when the screen leaves or the
   sounds are switched off. The session is the effects' one
   (src/lib/audio.ts): the sounds mix with what else plays, never take
   the audio focus and keep quiet while the phone is on silent or
   vibrate. A pool that must answer at once (a game's catch) makes its
   players up front, as it comes into view, instead of on a first play.
   The elf's sounds (features/elf/useElfSounds.ts) and the games' sounds
   (features/elf/games/GameSounds.tsx) are such pools. */

export type SoundSpec = { module: number; volume: number; minGapMs: number }

/* A player is paused before it is removed: on Android, expo-audio's
   remove() releases the object but a player still playing (a loop)
   keeps sounding until it is collected. */
export function releasePlayer(player: AudioPlayer) {
  try {
    player.pause()
  } catch {
    // Already released.
  }
  player.remove()
}

/* Whether sounds play right now: the screen in view and the switch on. */
export function useSoundsOn(inView: boolean): boolean {
  const { enabled } = useSoundPrefs()
  return inView && enabled
}

export function useSoundPool<K extends string>(specs: Record<K, SoundSpec>, inView: boolean, preload = false): (sound: K) => void {
  const on = useSoundsOn(inView)
  const players = useRef(new Map<K, AudioPlayer>())
  const lastPlayed = useRef(new Map<K, number>())
  /* Read when a session comes through, which can be after the screen left. */
  const onRef = useRef(on)
  onRef.current = on

  const playerFor = useCallback(
    (sound: K) => {
      let player = players.current.get(sound)
      if (!player) {
        player = createAudioPlayer(specs[sound].module)
        player.volume = specs[sound].volume
        players.current.set(sound, player)
      }
      return player
    },
    [specs],
  )

  useEffect(() => {
    if (!on) return
    const pool = players.current
    if (preload) (Object.keys(specs) as K[]).forEach(playerFor)
    return () => {
      pool.forEach(releasePlayer)
      pool.clear()
    }
  }, [on, preload, specs, playerFor])

  return useCallback(
    (sound: K) => {
      if (!on) return
      const now = Date.now()
      if (now - (lastPlayed.current.get(sound) ?? 0) < specs[sound].minGapMs) return
      lastPlayed.current.set(sound, now)
      void enterAudioSession('effects').then(() => {
        if (!onRef.current) return
        const player = playerFor(sound)
        void player.seekTo(0).then(() => player.play())
      })
    },
    [on, specs, playerFor],
  )
}
