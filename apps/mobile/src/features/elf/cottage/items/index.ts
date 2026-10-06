import type { ReactElement } from 'react'
import type { Bounds, Slot } from '../room'
import { FIREPLACE_BOUNDS, Fireplace, type FireMotion } from './Fireplace'
import { WindowArched, WINDOW_ARCHED_BOUNDS } from './window/Arched'
import { WindowRound, WINDOW_ROUND_BOUNDS } from './window/Round'
import { WindowShuttered, WINDOW_SHUTTERED_BOUNDS } from './window/Shuttered'
import { PictureCottage, PICTURE_COTTAGE_BOUNDS } from './picture/Cottage'
import { PictureMap, PICTURE_MAP_BOUNDS } from './picture/Map'
import { PictureAntlers, PICTURE_ANTLERS_BOUNDS } from './picture/Antlers'
import { HerbsHerbs, HERBS_HERBS_BOUNDS } from './herbs/Herbs'
import { HerbsGarlic, HERBS_GARLIC_BOUNDS } from './herbs/Garlic'
import { HerbsDreamcatcher, HERBS_DREAMCATCHER_BOUNDS } from './herbs/Dreamcatcher'
import { LanternIron, LANTERN_IRON_BOUNDS } from './lantern/Iron'
import { LanternPaper, LANTERN_PAPER_BOUNDS } from './lantern/Paper'
import { LanternBell, LANTERN_BELL_BOUNDS } from './lantern/Bell'
import { ShelfBooks, SHELF_BOOKS_BOUNDS } from './shelf/Books'
import { ShelfJars, SHELF_JARS_BOUNDS } from './shelf/Jars'
import { ShelfSeedlings, SHELF_SEEDLINGS_BOUNDS } from './shelf/Seedlings'
import { RugBraided, RUG_BRAIDED_BOUNDS } from './rug/Braided'
import { RugWoven, RUG_WOVEN_BOUNDS } from './rug/Woven'
import { RugMoss, RUG_MOSS_BOUNDS } from './rug/Moss'
import { BedOak, BED_OAK_BOUNDS } from './bed/Oak'
import { BedHammock, BED_HAMMOCK_BOUNDS } from './bed/Hammock'
import { BedNest, BED_NEST_BOUNDS } from './bed/Nest'
import { BasketAcorns, BASKET_ACORNS_BOUNDS } from './basket/Acorns'
import { BasketFirewood, BASKET_FIREWOOD_BOUNDS } from './basket/Firewood'
import { BasketPumpkins, BASKET_PUMPKINS_BOUNDS } from './basket/Pumpkins'
import { FernFern, FERN_FERN_BOUNDS } from './fern/Fern'
import { FernMushroom, FERN_MUSHROOM_BOUNDS } from './fern/Mushroom'
import { FernStump, FERN_STUMP_BOUNDS } from './fern/Stump'
import { CandleCandle, CANDLE_CANDLE_BOUNDS } from './candle/Candle'
import { CandleCauldron, CANDLE_CAULDRON_BOUNDS } from './candle/Cauldron'
import { CandleToyChest, CANDLE_TOYCHEST_BOUNDS } from './candle/ToyChest'

/* The catalogue of the cottage's furniture: every slot of the room, the
   variants that can stand in it and which of them the room starts with.
   Each variant is a Skia component that draws itself around its slot's
   anchor (items with a flame also read the fire motion) and the box it
   covers, so the wardrobe sheet can frame a thumbnail and the scene can
   lay a hit box over it. The first id of every slot is the default and is
   what the room has always drawn; the fireplace has one variant and is
   not editable. The stored decor of an elf is a plain map of slot id to
   variant id (the rules keep it without knowing the slots); decorItem
   resolves an id and falls back to the slot's default when the id is
   unknown, so a renamed variant never leaves a hole in the wall. The slots'
   anchors and hit boxes live in ../room. */

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

export type DecorItemProps = { slot: Slot; fire: FireMotion }

export type DecorItem = {
  id: string
  Component: (props: DecorItemProps) => ReactElement
  /* The item's extent around the anchor in room units, for thumbnails
     and hit boxes. */
  bounds: Bounds
}

export const DECOR_ITEMS: Record<SlotId, readonly DecorItem[]> = {
  window: [
    { id: 'arched', Component: WindowArched, bounds: WINDOW_ARCHED_BOUNDS },
    { id: 'round', Component: WindowRound, bounds: WINDOW_ROUND_BOUNDS },
    { id: 'shuttered', Component: WindowShuttered, bounds: WINDOW_SHUTTERED_BOUNDS },
  ],
  picture: [
    { id: 'cottage', Component: PictureCottage, bounds: PICTURE_COTTAGE_BOUNDS },
    { id: 'map', Component: PictureMap, bounds: PICTURE_MAP_BOUNDS },
    { id: 'antlers', Component: PictureAntlers, bounds: PICTURE_ANTLERS_BOUNDS },
  ],
  herbs: [
    { id: 'herbs', Component: HerbsHerbs, bounds: HERBS_HERBS_BOUNDS },
    { id: 'garlic', Component: HerbsGarlic, bounds: HERBS_GARLIC_BOUNDS },
    { id: 'dreamcatcher', Component: HerbsDreamcatcher, bounds: HERBS_DREAMCATCHER_BOUNDS },
  ],
  lantern: [
    { id: 'iron', Component: LanternIron, bounds: LANTERN_IRON_BOUNDS },
    { id: 'paper', Component: LanternPaper, bounds: LANTERN_PAPER_BOUNDS },
    { id: 'bell', Component: LanternBell, bounds: LANTERN_BELL_BOUNDS },
  ],
  shelf: [
    { id: 'books', Component: ShelfBooks, bounds: SHELF_BOOKS_BOUNDS },
    { id: 'jars', Component: ShelfJars, bounds: SHELF_JARS_BOUNDS },
    { id: 'seedlings', Component: ShelfSeedlings, bounds: SHELF_SEEDLINGS_BOUNDS },
  ],
  rug: [
    { id: 'braided', Component: RugBraided, bounds: RUG_BRAIDED_BOUNDS },
    { id: 'woven', Component: RugWoven, bounds: RUG_WOVEN_BOUNDS },
    { id: 'moss', Component: RugMoss, bounds: RUG_MOSS_BOUNDS },
  ],
  bed: [
    { id: 'oak', Component: BedOak, bounds: BED_OAK_BOUNDS },
    { id: 'hammock', Component: BedHammock, bounds: BED_HAMMOCK_BOUNDS },
    { id: 'nest', Component: BedNest, bounds: BED_NEST_BOUNDS },
  ],
  basket: [
    { id: 'acorns', Component: BasketAcorns, bounds: BASKET_ACORNS_BOUNDS },
    { id: 'firewood', Component: BasketFirewood, bounds: BASKET_FIREWOOD_BOUNDS },
    { id: 'pumpkins', Component: BasketPumpkins, bounds: BASKET_PUMPKINS_BOUNDS },
  ],
  fern: [
    { id: 'fern', Component: FernFern, bounds: FERN_FERN_BOUNDS },
    { id: 'mushroom', Component: FernMushroom, bounds: FERN_MUSHROOM_BOUNDS },
    { id: 'stump', Component: FernStump, bounds: FERN_STUMP_BOUNDS },
  ],
  candle: [
    { id: 'candle', Component: CandleCandle, bounds: CANDLE_CANDLE_BOUNDS },
    { id: 'cauldron', Component: CandleCauldron, bounds: CANDLE_CAULDRON_BOUNDS },
    { id: 'toyChest', Component: CandleToyChest, bounds: CANDLE_TOYCHEST_BOUNDS },
  ],
  fireplace: [{ id: 'fieldstone', Component: Fireplace, bounds: FIREPLACE_BOUNDS }],
}

/* The id's item in that slot, or the slot's default when the id is unknown. */
export function decorItem(slot: SlotId, id: string): DecorItem {
  const items = DECOR_ITEMS[slot]
  return items.find((item) => item.id === id) ?? items[0]!
}

/* Whether the slot can be given a different item in edit mode. */
export function isEditableSlot(slot: SlotId): boolean {
  return DECOR_IDS[slot].length > 1
}

/* Whether a string names a slot of the room. */
export function isSlotId(value: string): value is SlotId {
  return (SLOT_IDS as readonly string[]).includes(value)
}
