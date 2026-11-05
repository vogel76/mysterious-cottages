import type { ElfGameId } from '@chatynkowo/core'
import { AcornsIcon, EchoGameIcon, MemoryGameIcon, type Icon } from '../../../ui'

/* The games as the app shows them: a picture each and the key of their
   name (the boards carry their own words on how they are played). The
   boards are AcornsGame (three hearts, faster as it goes), MemoryGame
   (boards that grow) and EchoGame (a melody to repeat, longer each
   round), the frame around them ElfGameScreen; the rules hold the
   elf's energy a round takes, the pay by each game's rate and the
   records (packages/core: gameRounds, recordGame, GAME_POINTS_PER_ACORN). */

export const GAME_ICON: Record<ElfGameId, Icon> = {
  acorns: AcornsIcon,
  memory: MemoryGameIcon,
  echo: EchoGameIcon,
}

export function gameKey(id: ElfGameId): string {
  return `mobile:elf.game${id.charAt(0).toUpperCase()}${id.slice(1)}`
}
