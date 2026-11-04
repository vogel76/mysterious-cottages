import type { ElfEvent, ElfMood, ElfNeedId, ElfNodeId, ElfPath, ElfRank, ElfStage, ElfStarter } from '@chatynkowo/core'
import { BathIcon, CottageIcon, DecorIcon, EggIcon, FeedIcon, ForestIcon, FoundIcon, GamesIcon, JoyIcon, LoreIcon, SleepIcon, ToyIcon, WarmIcon, type Icon } from '../../ui'

/* How the elf's ids (a form, an element, a need, a mood, a quest, a
   wearable or decor slot, an item of either catalogue, a find of the
   sill, a stage of the plant) map to the copy in the "elf" group of the
   mobile dictionary and to the vocabulary's glyphs. The
   dictionary names each entry with a prefix and the id in title case
   (stageBaby, starterEmber, needJoy, moodAsleep, wantsClean, guardCharging,
   questFeedTwice, slotHat, itemAcornCap, sillPinecone), so the screens build the key
   here rather than spelling out every switch themselves. */

function titleCase(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1)
}

/* The full i18next key for a prefixed entry of the elf group. */
export function elfKey(prefix: 'stage' | 'starter' | 'need' | 'wants' | 'mood' | 'guard' | 'evo' | 'quest' | 'slot' | 'item' | 'sill', id: ElfStage | ElfStarter | ElfNeedId | ElfMood | string): string {
  return `mobile:elf.${prefix}${titleCase(id)}`
}

/* The name of the plant's stage, 0..4. */
export function plantStageKey(stage: number): string {
  return `mobile:elf.plantStage${stage}`
}

/* The description of a starter element sits next to its name. */
export function starterDescriptionKey(starter: ElfStarter): string {
  return `mobile:elf.starter${titleCase(starter)}Desc`
}

/* The three elements: the evergreen for the forest, the flame for the
   ember, the moon and stars for the mystic. */
export const STARTER_ICONS: Record<ElfStarter, Icon> = {
  forest: ForestIcon,
  ember: WarmIcon,
  mystic: LoreIcon,
}

/* The three needs with the glyph of the care that answers each. */
export const NEED_ICONS: Record<ElfNeedId, Icon> = {
  fullness: FeedIcon,
  joy: JoyIcon,
  clean: BathIcon,
}

/* The day's quests by what they count: the care's own glyphs, the heart
   for a pet, the armchair for a swap, the moon for the tuck-in, the egg,
   the cottage for a visit, the hearth for an evening one, the
   expedition's own tick for a cottage found and the controller for a
   game played. */
export const QUEST_ICONS: Record<ElfEvent, Icon> = {
  feed: FeedIcon,
  play: ToyIcon,
  bath: BathIcon,
  pet: JoyIcon,
  decor: DecorIcon,
  sleep: SleepIcon,
  egg: EggIcon,
  open: CottageIcon,
  evening: WarmIcon,
  find: FoundIcon,
  game: GamesIcon,
}

/* The rank's name (mobile:elf.rankSpark...). */
export function rankKey(rank: ElfRank): string {
  return `mobile:elf.rank${titleCase(rank)}`
}

/* A path's name and a node's name or effect (mobile:elf.pathGlutton,
   nodeGlutton1, nodeGlutton1Effect). */
export function pathKey(path: ElfPath): string {
  return `mobile:elf.path${titleCase(path)}`
}

export function nodeKey(id: ElfNodeId, part: 'name' | 'effect' = 'name'): string {
  return `mobile:elf.node${titleCase(id)}${part === 'effect' ? 'Effect' : ''}`
}
