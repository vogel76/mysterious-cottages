import type { ElfGameId } from '@chatynkowo/core'
import { AcornsIcon, MemoryGameIcon, type Icon } from '../../../ui'

/* The games as the app shows them: a picture each and their strings
   (the name, what the game is, how it is played). The boards are
   AcornsGame and MemoryGame, the frame around them ElfGameScreen; the
   rules hold the rounds a day, the pay and the records (packages/core:
   gamePlaysLeft, recordGame). */

export const GAME_ICON: Record<ElfGameId, Icon> = {
  acorns: AcornsIcon,
  memory: MemoryGameIcon,
}

export function gameKey(id: ElfGameId, part: 'name' | 'desc' | 'how' = 'name'): string {
  const title = `${id.charAt(0).toUpperCase()}${id.slice(1)}`
  return `mobile:elf.game${title}${part === 'name' ? '' : part === 'desc' ? 'Desc' : 'How'}`
}
