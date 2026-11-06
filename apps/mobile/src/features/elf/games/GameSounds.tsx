import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react'
import { useSoundPool, type SoundSpec } from '../../../lib/sound-pool'

/* The games' sounds: one pool for every board, held by the game's frame
   (ElfGameScreen) rather than by a board, so the last sound of a round
   (the heart that ended it, a wrong tile) is not cut off when the board
   gives way to the round's card, and the card's own close or fanfare
   plays from the same pool. All are synthesised (art/sounds/synth.py):
   soft, short and low, nothing grating above 2 kHz, so a long round
   never tires the ear. They follow the elf's switch and the phone's
   silent mode (src/lib/sound-pool.ts), and the players are made as the
   frame opens, so the first catch is heard on time. A move in a game
   makes a sound; a button around it (the start, once more, back) never
   does. */

export type GameSound =
  | 'note1'
  | 'note2'
  | 'note3'
  | 'note4'
  | 'wrong'
  | 'catch'
  | 'twinkle'
  | 'miss'
  | 'storm'
  | 'right'
  | 'flip'
  | 'hop'
  | 'cleared'
  | 'over'
  | 'record'

const SOUNDS: Record<GameSound, SoundSpec> = {
  /* The forest echo's four notes. */
  note1: { module: require('../../../../assets/elf/sounds/echo1.wav'), volume: 0.55, minGapMs: 60 },
  note2: { module: require('../../../../assets/elf/sounds/echo2.wav'), volume: 0.55, minGapMs: 60 },
  note3: { module: require('../../../../assets/elf/sounds/echo3.wav'), volume: 0.55, minGapMs: 60 },
  note4: { module: require('../../../../assets/elf/sounds/echo4.wav'), volume: 0.55, minGapMs: 60 },
  /* A wrong choice (a tile, a cap): a soft falling "oh-oh". */
  wrong: { module: require('../../../../assets/elf/sounds/game-wrong.wav'), volume: 0.5, minGapMs: 200 },
  /* A catch: an acorn tapped, a star in the basket. */
  catch: { module: require('../../../../assets/elf/sounds/game-catch.wav'), volume: 0.5, minGapMs: 40 },
  twinkle: { module: require('../../../../assets/elf/sounds/game-twinkle.wav'), volume: 0.5, minGapMs: 40 },
  /* A heart lost; a storm caught rumbles instead. */
  miss: { module: require('../../../../assets/elf/sounds/game-miss.wav'), volume: 0.5, minGapMs: 120 },
  storm: { module: require('../../../../assets/elf/sounds/game-storm.wav'), volume: 0.55, minGapMs: 300 },
  /* A right choice: the acorn found, a pair, a melody echoed. */
  right: { module: require('../../../../assets/elf/sounds/game-right.wav'), volume: 0.5, minGapMs: 150 },
  /* A card turned, a cap's hop: quiet, they come often. */
  flip: { module: require('../../../../assets/elf/sounds/game-flip.wav'), volume: 0.35, minGapMs: 40 },
  hop: { module: require('../../../../assets/elf/sounds/game-hop.wav'), volume: 0.3, minGapMs: 60 },
  /* A memory board cleared; a round's end, and a new record. */
  cleared: { module: require('../../../../assets/elf/sounds/game-cleared.wav'), volume: 0.5, minGapMs: 500 },
  over: { module: require('../../../../assets/elf/sounds/game-over.wav'), volume: 0.5, minGapMs: 800 },
  record: { module: require('../../../../assets/elf/sounds/game-record.wav'), volume: 0.55, minGapMs: 800 },
}

const Play = createContext<(sound: GameSound) => void>(() => {})

export function GameSounds({ children }: { children: ReactNode }) {
  const play = useSoundPool(SOUNDS, true, true)
  /* One function for the frame's whole life, so a board's timers can
     keep it; it always plays through the pool as it now is. */
  const latest = useRef(play)
  latest.current = play
  const stable = useCallback((sound: GameSound) => latest.current(sound), [])
  return <Play.Provider value={stable}>{children}</Play.Provider>
}

export function useGameSound(): (sound: GameSound) => void {
  return useContext(Play)
}
