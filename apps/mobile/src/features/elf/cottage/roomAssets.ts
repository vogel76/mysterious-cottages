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
   slack.

   The manifest also holds the pieces the days bring rather than the
   player (extraSpriteFor): the plant on the windowsill in its stages, the
   small things the elf finds, drawn at the sill's places (SILL_OFFSETS),
   the letter on the floor, and the egg before the hatch in its pieces
   (the nest's two halves, the shell whole and cracked, its cap and base,
   its glow), with the point it rests on (EGG_BASE). */

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
  /* The sill's places for the elf's finds, as x offsets from where a
     find's render stands (the first place). */
  sillOffsets?: number[]
  /* Where the egg rests in its nest, plate pixels: what it rocks about. */
  eggBase?: [number, number]
  sprites: RoomSpriteEntry[]
}

export const ROOM_MANIFEST: RoomManifest = require('../../../../assets/elf/room/manifest.json')

/* A render the scene can draw: the manifest's entry with its bundled
   modules, the daytime one and the close-up null where no such render
   exists. A sprite is one of a decor slot. */
export type RoomPicture = RoomSpriteEntry & { module: number; moduleDay: number | null; moduleThumb: number | null }
export type RoomSprite = RoomPicture & { slot: SlotId }

function fileModule(name: string | undefined): number | null {
  if (!name) return null
  const module = ROOM_FILES[name]
  if (module === undefined && __DEV__) console.warn(`room manifest names "${name}", which roomFiles does not register`)
  return module ?? null
}

/* The pieces the days bring, by their slot in the manifest. */
export type ExtraSlot = 'plant' | 'sill' | 'letter' | 'egg'
const EXTRA_SLOTS: readonly string[] = ['plant', 'sill', 'letter', 'egg'] satisfies readonly ExtraSlot[]
export function isExtraSlot(slot: string): slot is ExtraSlot {
  return EXTRA_SLOTS.includes(slot)
}

/* The manifest's sprites grouped by slot, with their modules, built once:
   the decor's and the days' apart. */
const SPRITES_BY_SLOT = new Map<SlotId, RoomSprite[]>()
const EXTRAS_BY_SLOT = new Map<string, RoomPicture[]>()
for (const entry of ROOM_MANIFEST.sprites) {
  const module = fileModule(entry.file)
  if (module === null) continue
  const picture: RoomPicture = { ...entry, module, moduleDay: fileModule(entry.fileDay), moduleThumb: fileModule(entry.fileThumb) }
  if (isSlotId(entry.slot)) {
    const sprite: RoomSprite = { ...picture, slot: entry.slot }
    const list = SPRITES_BY_SLOT.get(entry.slot)
    if (list) list.push(sprite)
    else SPRITES_BY_SLOT.set(entry.slot, [sprite])
  } else if (isExtraSlot(entry.slot)) {
    const list = EXTRAS_BY_SLOT.get(entry.slot)
    if (list) list.push(picture)
    else EXTRAS_BY_SLOT.set(entry.slot, [picture])
  }
}

/* The render of one of the days' pieces: the plant's stage ('stage0'..),
   a find ('pinecone'..) at the sill's first place, the letter
   ('envelope'), a piece of the egg ('nestBack'..); null where the renders
   have none. */
export function extraSpriteFor(slot: ExtraSlot, variant: string): RoomPicture | null {
  return EXTRAS_BY_SLOT.get(slot)?.find((picture) => picture.variant === variant) ?? null
}

/* The sill's places, as x offsets from the first; one place when the
   manifest names none. */
export const SILL_OFFSETS: readonly number[] = ROOM_MANIFEST.sillOffsets?.length ? ROOM_MANIFEST.sillOffsets : [0]

/* The point the egg rests on, plate pixels; the rug's centre when the
   manifest has none. */
export const EGG_BASE: { x: number; y: number } = ROOM_MANIFEST.eggBase ? { x: ROOM_MANIFEST.eggBase[0], y: ROOM_MANIFEST.eggBase[1] } : ROOM_MANIFEST.rug

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

/* What the days have brought into the room: the plant's stage (0..4), the
   finds on the sill, newest first, and whether a letter waits on the
   floor. */
export type RoomExtras = { plantStage: number; sill: readonly string[]; letter: boolean }

/* A render of the days' pieces with how far right of its box it is drawn. */
export type PlacedPicture = { picture: RoomPicture; dx: number }

/* The days' renders to draw for the extras: the plant, the finds at the
   sill's places (as many as it has), and the letter. */
export function extraPictures(extras: RoomExtras): { plant: RoomPicture | null; sill: PlacedPicture[]; letter: RoomPicture | null } {
  const sill: PlacedPicture[] = []
  extras.sill.slice(0, SILL_OFFSETS.length).forEach((item, index) => {
    const picture = extraSpriteFor('sill', item)
    if (picture) sill.push({ picture, dx: SILL_OFFSETS[index]! })
  })
  return { plant: extraSpriteFor('plant', `stage${extras.plantStage}`), sill, letter: extras.letter ? extraSpriteFor('letter', 'envelope') : null }
}

/* The box around some placed renders, widened by the slot slack; null
   for none. */
export function placedBounds(placed: readonly PlacedPicture[]): Bounds | null {
  if (placed.length === 0) return null
  const left = Math.min(...placed.map(({ picture, dx }) => picture.x + dx))
  const top = Math.min(...placed.map(({ picture }) => picture.y))
  const right = Math.max(...placed.map(({ picture, dx }) => picture.x + dx + picture.width))
  const bottom = Math.max(...placed.map(({ picture }) => picture.y + picture.height))
  return { x: left - SLOT_SLACK, y: top - SLOT_SLACK, width: right - left + 2 * SLOT_SLACK, height: bottom - top + 2 * SLOT_SLACK }
}
