import { DECOR_IDS, DEFAULT_DECOR, PHOTO_ID, SLOT_IDS, isSlotId, isSurface, type Decor, type SlotId } from './catalogue'
import { SLOTS, type Bounds, type Slot } from './room'
import { ROOM_FILES } from './roomFiles'

/* The rendered room, as art/blender/room.py and its packer leave it in
   assets/elf/room: the plates (the empty room with its walls, floor, beams
   and the fireplace with its fire, rendered at exactly the room units of
   ./room, one for every pair of wall and floor the catalogue offers) and
   one transparent crop per piece of furniture, each with the box, in
   plate pixels, where it is drawn. Every plate and every piece comes by
   night and by day (the same camera, the moon turned into the sun), and
   the scene crossfades the two by the cottage's clock; every piece, wall
   and floor also has a close-up picture for the decorating catalogue.
   Metro only bundles what a static require names, so the packer
   generates ./roomFiles with every file of the folder, and the files are
   looked up here by the names the manifest gives.

   The renders are named after the catalogue's ids (./catalogue), so a
   decor id is its render; an id the renders do not have (a stored id from
   an older catalogue) draws the slot's default, so a stored decor never
   leaves a hole in the room. RENDERED_VARIANTS lists, per slot, the ids
   that have a render, which is what the decorating catalogue offers. The
   fireplace is baked into the plates and has no sprite.

   The scene takes its slot table from spriteSlotsFor: ./room's slots with
   the hit box of the piece actually drawn for the decor, with a little
   slack. */

type Box = { x: number; y: number; width: number; height: number }

/* One sprite of the manifest, as the packer writes it. */
export type RoomSpriteEntry = Box & {
  slot: string
  variant: string
  /* The render the room starts with in its slot. */
  default: boolean
  file: string
  /* The daytime render of the same piece, cropped to the same box. */
  fileDay?: string
  /* The piece rendered close up and by day for the decorating catalogue. */
  fileThumb?: string
}

/* A wall or a floor on offer, with its catalogue picture. */
type SurfaceEntry = { id: string; thumb?: string }

export type RoomManifest = {
  version: number
  width: number
  height: number
  /* Where the floor meets the wall, plate pixels. */
  floorY: number
  /* The centre of the rug, plate pixels. */
  rug: { x: number; y: number }
  walls: SurfaceEntry[]
  floors: SurfaceEntry[]
  /* The empty room for each "wall/floor" pair, by night and by day. */
  plates: Record<string, { night: string; day?: string }>
  sprites: RoomSpriteEntry[]
}

export const ROOM_MANIFEST: RoomManifest = require('../../../../assets/elf/room/manifest.json')

/* A sprite the scene can draw: the manifest's entry with its bundled
   modules, the daytime one and the catalogue's close-up null where no such
   render exists. */
export type RoomSprite = RoomSpriteEntry & { slot: SlotId; module: number; moduleDay: number | null; moduleThumb: number | null }

function fileModule(name: string | undefined): number | null {
  if (!name) return null
  const module = ROOM_FILES[name]
  if (module === undefined && __DEV__) console.warn(`room manifest names "${name}", which roomFiles does not register`)
  return module ?? null
}

/* The manifest's sprites grouped by slot, with their modules, built once. */
const SPRITES_BY_SLOT: ReadonlyMap<SlotId, readonly RoomSprite[]> = (() => {
  const map = new Map<SlotId, RoomSprite[]>()
  for (const entry of ROOM_MANIFEST.sprites) {
    const module = fileModule(entry.file)
    if (!isSlotId(entry.slot) || module === null) continue
    const sprite: RoomSprite = { ...entry, slot: entry.slot, module, moduleDay: fileModule(entry.fileDay), moduleThumb: fileModule(entry.fileThumb) }
    const list = map.get(entry.slot)
    if (list) list.push(sprite)
    else map.set(entry.slot, [sprite])
  }
  return map
})()

/* The rendered sprite that stands for a decor id in a slot: the render of
   that id, the slot's default for an id without one, and null for a
   place nothing is drawn for (the fireplace, the wall, the floor). */
export function roomSpriteFor(slot: SlotId, variantId: string): RoomSprite | null {
  const sprites = SPRITES_BY_SLOT.get(slot)
  if (!sprites || sprites.length === 0) return null
  return sprites.find((sprite) => sprite.variant === variantId) ?? sprites.find((sprite) => sprite.default) ?? sprites[0] ?? null
}

/* The plates of the decor's wall and floor, by night and by day; the
   default pair's where that pair was not rendered. */
export function roomPlateFor(decor: Decor): { night: number | null; day: number | null } {
  const plate = ROOM_MANIFEST.plates[`${decor.wall}/${decor.floor}`] ?? ROOM_MANIFEST.plates[`${DEFAULT_DECOR.wall}/${DEFAULT_DECOR.floor}`]
  return { night: fileModule(plate?.night), day: fileModule(plate?.day) }
}

/* The catalogue picture of a wall or a floor. */
export function surfaceThumbFor(slot: SlotId, id: string): number | null {
  const list = slot === 'wall' ? ROOM_MANIFEST.walls : slot === 'floor' ? ROOM_MANIFEST.floors : []
  return fileModule(list.find((entry) => entry.id === id)?.thumb)
}

/* The picture inside the frame's render, as shares of the render's box:
   the frame around it is a little thicker at the bottom. */
const PHOTO_INSET = { side: 0.11, top: 0.09, bottom: 0.1 } as const
export function photoRect(sprite: Box): Bounds {
  const side = sprite.width * PHOTO_INSET.side
  const top = sprite.height * PHOTO_INSET.top
  return { x: sprite.x + side, y: sprite.y + top, width: sprite.width - 2 * side, height: sprite.height - top - sprite.height * PHOTO_INSET.bottom }
}

/* Per slot, the decor ids that have a render of their own, in the
   catalogue's order: for a piece the ids with a sprite, for the wall and
   the floor the ids with a plate. The fireplace keeps its single id. The
   frame also offers the photo of the latest cottage found, drawn into its
   default render by the scene; the catalogue shows it only once there is
   a find. */
export const RENDERED_VARIANTS: Record<SlotId, readonly string[]> = (() => {
  const variants = {} as Record<SlotId, readonly string[]>
  for (const slot of SLOT_IDS) {
    const ids = DECOR_IDS[slot]
    if (isSurface(slot)) {
      const rendered = new Set((slot === 'wall' ? ROOM_MANIFEST.walls : ROOM_MANIFEST.floors).map((entry) => entry.id))
      variants[slot] = ids.filter((id) => rendered.has(id))
      continue
    }
    const sprites = SPRITES_BY_SLOT.get(slot) ?? []
    const rendered = ids.filter((id) => sprites.some((sprite) => sprite.variant === id))
    variants[slot] = rendered.length > 0 ? rendered : ids.slice(0, 1)
  }
  variants.picture = [...variants.picture, PHOTO_ID]
  return variants
})()

/* The id the catalogue shows as placed for a decor id: the id itself
   where it is on offer, the slot's default otherwise (the room draws the
   default for it). */
export function renderedVariantFor(slot: SlotId, id: string): string {
  return RENDERED_VARIANTS[slot].includes(id) ? id : DEFAULT_DECOR[slot]
}

/* Slack around a rendered piece, room units, so a finger a little off
   its edge still lands on it. */
const SLOT_SLACK = 15

/* The box of the sprite drawn for a decor id, relative to the slot's
   anchor and widened by the slack; null for a place with no sprite. */
export function spriteSlotBounds(slot: Slot, variantId: string): Bounds | null {
  const sprite = roomSpriteFor(slot.id, variantId)
  if (!sprite) return null
  return { x: sprite.x - slot.x - SLOT_SLACK, y: sprite.y - slot.y - SLOT_SLACK, width: sprite.width + 2 * SLOT_SLACK, height: sprite.height + 2 * SLOT_SLACK }
}

/* The slot table of the rendered room for a decor: ./room's slots with
   their hit boxes replaced by the drawn pieces' boxes, so the taps, the
   glances and the light of the decorating mode land on the picture. A
   place without a sprite (the fireplace, the wall, the floor) keeps
   ./room's box. */
export function spriteSlotsFor(decor: Decor): readonly Slot[] {
  return SLOTS.map((slot) => {
    const hit = spriteSlotBounds(slot, decor[slot.id])
    return hit ? { ...slot, hit } : slot
  })
}
