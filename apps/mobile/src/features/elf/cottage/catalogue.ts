import type { ElfOutfit, WearableSlot } from '@chatynkowo/core'

/* The catalogues of the cottage: the furniture slots of the room with the
   variants that can stand in each (the first id is the default the room
   starts with; the fireplace has one and is not editable), and the five
   wardrobe slots with their ids. These are the ids the rules (packages/core,
   elf.ts) store and the
   dictionaries name (packages/i18n, the item* and slot* entries of the elf
   group). Which of them have a rendered picture today is roomAssets'
   business (RENDERED_VARIANTS lists them per slot); a wearable has none
   yet, since the rendered elf's face and hood are baked into its frames,
   so the wardrobe ids wait for the art pipeline's layers. The stored decor
   and outfit of an elf are plain maps of slot id to variant id, kept by
   the rules without knowing the slots; the provider resolves them against
   these catalogues and falls back to the slot's default for an unknown id,
   so a renamed variant never leaves a hole in the wall. The slots' anchors
   and hit boxes live in ./room. */

export type SlotId = 'window' | 'herbs' | 'shelf' | 'lantern' | 'picture' | 'fireplace' | 'rug' | 'bed' | 'basket' | 'fern' | 'candle'

export const SLOT_IDS: readonly SlotId[] = ['window', 'herbs', 'shelf', 'lantern', 'picture', 'fireplace', 'rug', 'bed', 'basket', 'fern', 'candle']

export const DECOR_IDS: Record<SlotId, readonly string[]> = {
  window: ['arched', 'round', 'shuttered'],
  picture: ['cottage', 'map', 'antlers'],
  herbs: ['herbs', 'garlic', 'dreamcatcher'],
  lantern: ['iron', 'paper', 'bell'],
  shelf: ['books', 'jars', 'seedlings'],
  rug: ['braided', 'woven', 'moss'],
  bed: ['oak', 'hammock', 'nest'],
  basket: ['acorns', 'firewood', 'pumpkins'],
  fern: ['fern', 'mushroom', 'stump'],
  candle: ['candle', 'cauldron', 'toyChest'],
  fireplace: ['fieldstone'],
}

/* Which variant stands in which slot. */
export type Decor = Record<SlotId, string>

export const DEFAULT_DECOR: Decor = {
  window: 'arched',
  picture: 'cottage',
  herbs: 'herbs',
  lantern: 'iron',
  shelf: 'books',
  rug: 'braided',
  bed: 'oak',
  basket: 'acorns',
  fern: 'fern',
  candle: 'candle',
  fireplace: 'fieldstone',
}

/* Whether a string names a slot of the room. */
export function isSlotId(value: string): value is SlotId {
  return (SLOT_IDS as readonly string[]).includes(value)
}

/* The wardrobe: the first id of hat and outfit is the classic look, 'none'
   leaves a slot empty. */
export const WEARABLE_IDS: Record<WearableSlot, readonly string[]> = {
  hat: ['hood', 'acornCap', 'mushroomCap', 'flowerCrown', 'nightcap'],
  outfit: ['tunic', 'vest', 'apron', 'cloak'],
  neck: ['none', 'scarf', 'amulet'],
  hand: ['none', 'lantern', 'acorn', 'book'],
  face: ['none', 'glasses', 'freckles'],
}

export const DEFAULT_OUTFIT: ElfOutfit = { hat: 'hood', outfit: 'tunic', neck: 'none', hand: 'none', face: 'none' }
