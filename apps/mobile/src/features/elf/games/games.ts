import type { ElfGameId } from '@chatynkowo/core'
import { AcornsIcon, EchoGameIcon, MemoryGameIcon, MushroomsGameIcon, StarRainGameIcon, type Icon } from '../../../ui'

/* The games as the app shows them: a picture each and the key of their
   name (the boards carry their own words on how they are played). The
   boards are AcornsGame (three hearts, more and faster as it goes),
   MemoryGame (boards that grow), EchoGame (a melody to repeat, longer
   each round), StarRainGame (stars to catch in a basket, storms to keep
   out) and MushroomsGame (the acorn to follow under shuffled caps), the
   frame around them ElfGameScreen; the rules hold the elf's energy a
   round takes, the pay by each game's rate and the records
   (packages/core: gameRounds, recordGame, GAME_POINTS_PER_ACORN). */

export const GAME_ICON: Record<ElfGameId, Icon> = {
  acorns: AcornsIcon,
  memory: MemoryGameIcon,
  echo: EchoGameIcon,
  stars: StarRainGameIcon,
  mushrooms: MushroomsGameIcon,
}

/* A round's end, as a board reports it: its points and, for a loss the
   board can undo (the last heart gone, a miss too many, a wrong tile),
   the way to play on with one more life. The frame offers that once a
   round, for dust or an ad, and otherwise settles the round. */
export type GameFinish = (points: number, revive?: () => void) => void

/* The breath a game against the clock takes before it goes on with one
   more life: the player comes back from an ad or the card with a single
   heart, and an acorn or a star already on its way would take it before
   the thumb is back on the board. */
export const REVIVE_BREATH_MS = 1500

export function gameKey(id: ElfGameId): string {
  return `mobile:elf.game${id.charAt(0).toUpperCase()}${id.slice(1)}`
}
