import { DECOR_IDS, PHOTO_ID, SLOT_IDS, isSlotId, type Decor, type SlotId } from './catalogue'
import { SLOTS, type Bounds, type Slot } from './room'

/* The rendered room, as art/blender/room.py and its packer leave it in
   assets/elf/room: the plate (the empty room with its walls, floor, beams
   and the fireplace with its fire, rendered at exactly the room units of
   ./room, 1000 by 1600) and one transparent crop per piece of furniture,
   each with the box, in plate pixels, where it is drawn. The plate and
   every sprite come by night and by day (the same camera, the moon
   turned into the sun), and the scene crossfades the two by the
   cottage's clock. Metro only bundles what a static require names, so
   every file of the folder is listed here by hand next to the manifest.

   The renders do not cover every variant the catalogue (./catalogue)
   names: a slot with three ids may have one or two renders. roomSpriteFor
   maps the app's decor ids onto what exists (two ids may share a render,
   the way the woven and the moss rug both come out as the green one), so
   a stored decor never leaves a hole in the room, and RENDERED_VARIANTS
   lists, per slot, the ids that look different on screen, which is what
   the decorating panel offers. The fireplace is baked into the plate and
   has no sprite.

   The hit boxes of ./room were laid out before the Blender room, which
   hangs its pieces elsewhere (the lantern in the top right corner, the
   shelf on the left wall), so the scene takes its slot table from
   spriteSlotsFor: the same slots with the hit box of the piece actually
   drawn for the decor, with a little slack, and the room's own box only
   where nothing was rendered. */

/* One sprite of the manifest, as the packer writes it. */
export type RoomSpriteEntry = {
  slot: string
  variant: string
  file: string
  /* The daytime render of the same piece, cropped to the same box. */
  fileDay?: string
  /* The box in plate pixels, which are room units. */
  x: number
  y: number
  width: number
  height: number
}

export type RoomManifest = {
  version: number
  plate: string
  /* The empty room by day, for the crossfade. */
  plateDay?: string
  width: number
  height: number
  /* Where the floor meets the wall, plate pixels. */
  floorY: number
  /* The centre of the rug, plate pixels. */
  rug: { x: number; y: number }
  sprites: RoomSpriteEntry[]
}

export const ROOM_MANIFEST: RoomManifest = require('../../../../assets/elf/room/manifest.json')

/* The plates' modules, as Metro's require gives them. */
export const ROOM_PLATE: number = require('../../../../assets/elf/room/plate.webp')
export const ROOM_PLATE_DAY: number = require('../../../../assets/elf/room/plate_day.webp')

/* Every sprite file of the folder by name. */
export const ROOM_FILES: Record<string, number> = {
  'basket_acorns.webp': require('../../../../assets/elf/room/basket_acorns.webp'),
  'basket_acorns_day.webp': require('../../../../assets/elf/room/basket_acorns_day.webp'),
  'bed_hammock.webp': require('../../../../assets/elf/room/bed_hammock.webp'),
  'bed_hammock_day.webp': require('../../../../assets/elf/room/bed_hammock_day.webp'),
  'bed_wooden.webp': require('../../../../assets/elf/room/bed_wooden.webp'),
  'bed_wooden_day.webp': require('../../../../assets/elf/room/bed_wooden_day.webp'),
  'candle_stool.webp': require('../../../../assets/elf/room/candle_stool.webp'),
  'candle_stool_day.webp': require('../../../../assets/elf/room/candle_stool_day.webp'),
  'fern_potted.webp': require('../../../../assets/elf/room/fern_potted.webp'),
  'fern_potted_day.webp': require('../../../../assets/elf/room/fern_potted_day.webp'),
  'herbs_dried.webp': require('../../../../assets/elf/room/herbs_dried.webp'),
  'herbs_dried_day.webp': require('../../../../assets/elf/room/herbs_dried_day.webp'),
  'lantern_iron.webp': require('../../../../assets/elf/room/lantern_iron.webp'),
  'lantern_iron_day.webp': require('../../../../assets/elf/room/lantern_iron_day.webp'),
  'picture_framed.webp': require('../../../../assets/elf/room/picture_framed.webp'),
  'picture_framed_day.webp': require('../../../../assets/elf/room/picture_framed_day.webp'),
  'rug_braided.webp': require('../../../../assets/elf/room/rug_braided.webp'),
  'rug_braided_day.webp': require('../../../../assets/elf/room/rug_braided_day.webp'),
  'rug_green.webp': require('../../../../assets/elf/room/rug_green.webp'),
  'rug_green_day.webp': require('../../../../assets/elf/room/rug_green_day.webp'),
  'shelf_books.webp': require('../../../../assets/elf/room/shelf_books.webp'),
  'shelf_books_day.webp': require('../../../../assets/elf/room/shelf_books_day.webp'),
  'window_round.webp': require('../../../../assets/elf/room/window_round.webp'),
  'window_round_day.webp': require('../../../../assets/elf/room/window_round_day.webp'),
  'window_square.webp': require('../../../../assets/elf/room/window_square.webp'),
  'window_square_day.webp': require('../../../../assets/elf/room/window_square_day.webp'),
}

/* A sprite the scene can draw: the manifest's entry with its bundled
   modules, the daytime one null where no day render exists. */
export type RoomSprite = RoomSpriteEntry & { slot: SlotId; module: number; moduleDay: number | null }

/* The app's decor id to the manifest's variant, for the slots with more
   than one render. A slot missing here draws its one sprite whatever the
   id says. */
const VARIANT_RENDERS: Partial<Record<SlotId, Record<string, string>>> = {
  rug: { braided: 'braided', woven: 'green', moss: 'green' },
  bed: { oak: 'wooden', hammock: 'hammock', nest: 'hammock' },
  window: { arched: 'square', round: 'round', shuttered: 'square' },
}

/* The manifest's sprites grouped by slot, with their modules, built once. */
const SPRITES_BY_SLOT: ReadonlyMap<SlotId, readonly RoomSprite[]> = (() => {
  const map = new Map<SlotId, RoomSprite[]>()
  for (const entry of ROOM_MANIFEST.sprites) {
    const module = ROOM_FILES[entry.file]
    if (!isSlotId(entry.slot) || module === undefined) {
      if (__DEV__) console.warn(`room manifest names "${entry.file}" for slot "${entry.slot}", which is not registered in roomAssets`)
      continue
    }
    const moduleDay = entry.fileDay ? (ROOM_FILES[entry.fileDay] ?? null) : null
    const sprite: RoomSprite = { ...entry, slot: entry.slot, module, moduleDay }
    const list = map.get(entry.slot)
    if (list) list.push(sprite)
    else map.set(entry.slot, [sprite])
  }
  return map
})()

/* The rendered sprite that stands for a decor id in a slot: the mapped
   variant where the slot has several renders, the slot's one sprite
   otherwise, the first render for an id nobody mapped (as the provider
   falls back to the default), and null for the fireplace or a slot
   nothing was rendered for. */
export function roomSpriteFor(slot: SlotId, variantId: string): RoomSprite | null {
  const sprites = SPRITES_BY_SLOT.get(slot)
  if (!sprites || sprites.length === 0) return null
  const wanted = VARIANT_RENDERS[slot]?.[variantId]
  if (wanted) {
    const match = sprites.find((sprite) => sprite.variant === wanted)
    if (match) return match
  }
  return sprites[0] ?? null
}

/* The picture inside the frame's render: the frame is a thin dark border
   around it, a little thicker at the bottom. Plate pixels. */
const PHOTO_INSET = { side: 3, top: 3, bottom: 4 } as const
export function photoRect(sprite: RoomSpriteEntry): Bounds {
  return { x: sprite.x + PHOTO_INSET.side, y: sprite.y + PHOTO_INSET.top, width: sprite.width - 2 * PHOTO_INSET.side, height: sprite.height - PHOTO_INSET.top - PHOTO_INSET.bottom }
}

/* Per slot, the decor ids that have a render of their own, in the
   catalogue's order: the first id of every distinct render, so two ids
   that share a sprite are offered once. A slot with one render keeps its
   default id only; the fireplace keeps its single id too. The frame also
   offers the photo of the latest cottage found, drawn into its render by
   the scene; the panel shows it only once there is a find. */
export const RENDERED_VARIANTS: Record<SlotId, readonly string[]> = (() => {
  const variants = {} as Record<SlotId, readonly string[]>
  for (const slot of SLOT_IDS) {
    const renders = VARIANT_RENDERS[slot]
    const ids = DECOR_IDS[slot]
    if (!renders) {
      variants[slot] = ids.slice(0, 1)
      continue
    }
    const seen = new Set<string>()
    variants[slot] = ids.filter((id) => {
      const render = renders[id]
      if (!render || seen.has(render)) return false
      seen.add(render)
      return true
    })
  }
  variants.picture = [...variants.picture, PHOTO_ID]
  return variants
})()

/* Whether the slot offers a choice of renders. */
export function isRenderedEditableSlot(slot: SlotId): boolean {
  return RENDERED_VARIANTS[slot].length > 1
}

/* The id RENDERED_VARIANTS offers for a decor id: the first id with the
   same render, so a stored 'moss' rug is recognised as the green one the
   room shows. An id without a render mapping is returned as it is. */
export function renderedVariantFor(slot: SlotId, id: string): string {
  const render = VARIANT_RENDERS[slot]?.[id]
  if (!render) return id
  return RENDERED_VARIANTS[slot].find((candidate) => VARIANT_RENDERS[slot]?.[candidate] === render) ?? id
}

/* Slack around a rendered piece, room units, so a finger a little off
   its edge still lands on it. */
const SLOT_SLACK = 15

/* The box of the sprite drawn for a decor id, relative to the slot's
   anchor and widened by the slack; null for a slot with no render. */
export function spriteSlotBounds(slot: Slot, variantId: string): Bounds | null {
  const sprite = roomSpriteFor(slot.id, variantId)
  if (!sprite) return null
  return { x: sprite.x - slot.x - SLOT_SLACK, y: sprite.y - slot.y - SLOT_SLACK, width: sprite.width + 2 * SLOT_SLACK, height: sprite.height + 2 * SLOT_SLACK }
}

/* The slot table of the rendered room for a decor: ./room's slots with
   their hit boxes replaced by the drawn pieces' boxes, so the taps, the
   glances and the frames of edit mode land on the picture. A slot without
   a render (the fireplace, baked into the plate) keeps ./room's box. */
export function spriteSlotsFor(decor: Decor): readonly Slot[] {
  return SLOTS.map((slot) => {
    const hit = spriteSlotBounds(slot, decor[slot.id])
    return hit ? { ...slot, hit } : slot
  })
}
