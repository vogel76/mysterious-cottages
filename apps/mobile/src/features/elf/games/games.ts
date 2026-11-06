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

export function gameKey(id: ElfGameId): string {
  return `mobile:elf.game${id.charAt(0).toUpperCase()}${id.slice(1)}`
}
