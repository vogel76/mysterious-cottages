import type { ElfOutfit, WearableSlot } from '@chatynkowo/core'

/* The catalogues of the cottage: the places of the room with the variants
   that can stand in each (the first id is the default the room starts
   with; the fireplace has one and is not editable): the wall and the
   floor, which are the room's own surfaces (the plate is rendered for
   every pair), and the furniture slots, each a piece drawn over the
   plate; and the five wardrobe slots with their ids. These are the ids
   the rules (packages/core, elf.ts) store, the renders are named after
   (art/blender/room.py) and the dictionaries name (packages/i18n, the
   item* and slot* entries of the elf group). Which of them have a
   rendered picture is roomAssets' business (RENDERED_VARIANTS lists them
   per slot); a wearable has none yet, since the rendered elf's face and
   hair are baked into its frames, so the wardrobe ids wait for the art
   pipeline's layers. The stored decor
   and outfit of an elf are plain maps of slot id to variant id, kept by
   the rules without knowing the slots; the provider resolves them against
   these catalogues and falls back to the slot's default for an unknown id,
   so a renamed variant never leaves a hole in the wall. The slots' anchors
   and hit boxes live in ./room. */

export type SlotId = 'wall' | 'floor' | 'window' | 'herbs' | 'shelf' | 'lantern' | 'picture' | 'fireplace' | 'rug' | 'bed' | 'basket' | 'fern' | 'candle'

export const SLOT_IDS: readonly SlotId[] = ['wall', 'floor', 'window', 'herbs', 'shelf', 'lantern', 'picture', 'fireplace', 'rug', 'bed', 'basket', 'fern', 'candle']

/* The places that are the room's own surfaces: no piece is drawn for
   them, the plate of the pair is. */
export const SURFACE_SLOTS: readonly SlotId[] = ['wall', 'floor']

/* Whether a place is a surface of the room rather than a piece in it. */
export function isSurface(slot: SlotId): boolean {
  return slot === 'wall' || slot === 'floor'
}

/* The picture slot's id for the latest cottage found: the frame's render
   with the expedition's photo inside (roomAssets, RoomSprites). */
export const PHOTO_ID = 'photo'

export const DECOR_IDS: Record<SlotId, readonly string[]> = {
  wall: ['plaster', 'boards', 'logs'],
  floor: ['planks', 'flagstones', 'terracotta'],
  window: ['arched', 'round', 'shuttered'],
  picture: ['cottage', PHOTO_ID, 'map', 'antlers'],
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
  wall: 'plaster',
  floor: 'planks',
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
