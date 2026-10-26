import type { ElfMood, ElfNeedId, ElfStage, ElfStarter } from '@chatynkowo/core'
import { BathIcon, FeedIcon, ForestIcon, JoyIcon, LoreIcon, WarmIcon, type Icon } from '../../ui'

/* How the elf's ids (a form, an element, a need, a mood, a wearable or
   decor slot, an item of either catalogue) map to the copy in the "elf"
   group of the mobile dictionary and to the vocabulary's glyphs. The
   dictionary names each entry with a prefix and the id in title case
   (stageBaby, starterEmber, needJoy, moodAsleep, wantsClean, guardCap,
   slotHat, itemAcornCap), so the screens build the key here rather than
   spelling out every switch themselves. */

function titleCase(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1)
}

/* The full i18next key for a prefixed entry of the elf group. */
export function elfKey(prefix: 'stage' | 'starter' | 'need' | 'wants' | 'mood' | 'guard' | 'evo' | 'slot' | 'item', id: ElfStage | ElfStarter | ElfNeedId | ElfMood | string): string {
  return `mobile:elf.${prefix}${titleCase(id)}`
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
