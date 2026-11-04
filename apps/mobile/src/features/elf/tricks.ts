import type { ElfTrickId } from '@chatynkowo/core'
import { TrickApplauseIcon, TrickBowIcon, TrickCheerIcon, TrickToastIcon, TrickTwirlIcon, TrickWaveIcon, type Icon } from '../../ui'
import type { ReactionKind } from './cottage/motion'

/* The tricks as the app shows them: the reaction each plays in the
   scene (a clip the atlases already carry), its picture, and its strings
   (the name, what the elf does, and the line it says while showing it). */

export const TRICK_REACTION: Record<ElfTrickId, ReactionKind> = {
  wave: 'call',
  twirl: 'twirl',
  bow: 'greet',
  cheer: 'cheer',
  applause: 'admire',
  toast: 'sip',
}

export const TRICK_ICON: Record<ElfTrickId, Icon> = {
  wave: TrickWaveIcon,
  twirl: TrickTwirlIcon,
  bow: TrickBowIcon,
  cheer: TrickCheerIcon,
  applause: TrickApplauseIcon,
  toast: TrickToastIcon,
}

export function trickKey(id: ElfTrickId, part: 'name' | 'desc' | 'line' = 'name'): string {
  const title = `${id.charAt(0).toUpperCase()}${id.slice(1)}`
  return `mobile:elf.trick${title}${part === 'name' ? '' : part === 'desc' ? 'Desc' : 'Line'}`
}
