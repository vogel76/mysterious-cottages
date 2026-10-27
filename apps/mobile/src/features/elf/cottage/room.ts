/* The cottage room's coordinate contract. The room is designed once in
   "room units", the pixels of the rendered plate (1000 wide and 1300
   tall, as art/blender/room.py frames it and assets/elf/room/manifest.json
   records it), and the scene scales it to cover the part of the view the
   tab leaves free between its top strip (the HUD) and what covers the
   bottom (the care band, an open panel), the way a background image
   covers a screen, centred both ways; a narrow phone crops a little of
   each side, a short one a little of the top and bottom. Every drawing in
   the cottage (the room shell, the furniture, the elf, the lights) is laid
   out in these units and never knows the view's size; the layout here is
   the only place that converts between the two. Nothing of the interface
   lies over the room, so everything in the plate is on view.

   The floor meets the wall and the rug has its centre where the manifest
   says; the elf stands on the upper half of the rug, and everything
   important stays within x 60..940 so no phone crops it away. The slots place each piece of
   furniture by its base centre and say in which depth layer it is drawn:
   on the wall behind everything, on the floor behind the elf, or on the
   floor in front of it. Each slot also carries its tap target: the box,
   around the anchor, that a finger has to land in to poke the item. Both
   come from the plate's manifest: a piece's anchor and box are those of
   the slot's default render, the fireplace's (baked into the plate) and
   the wall's and the floor's (the room's surfaces) the boxes the renderer
   recorded for them, and the scene swaps in the box of the variant
   actually drawn (roomAssets.spriteSlotsFor). The variants
   themselves are named in ./catalogue and drawn from ./roomAssets; this
   module only knows the slots (a type-only import, so there is no cycle
   at runtime).

   The floor and the light overlays run on below the room's bottom edge by
   the overrun: the scene lifts the room while a panel is open at the
   bottom of the tab, so the elf and the furniture stay in view above it,
   and what comes up from under the edge must still be floor. */

import type { SlotId } from './catalogue'

/* A box in plate pixels, as the packer writes it. */
type PlateBox = { x: number; y: number; width: number; height: number }

/* The plate's frame, as the packer wrote it (a JSON require, so this
   module stays free of the asset registry that imports it). */
const PLATE: {
  width: number
  height: number
  floorY: number
  rug: { x: number; y: number }
  fireplace: PlateBox
  hearth: { x: number; y: number }
  wall: PlateBox
  floor: PlateBox
  sprites: readonly (PlateBox & { slot: string; default: boolean })[]
} = require('../../../../assets/elf/room/manifest.json')

/* How far above the rug's centre the figure's feet stand: the upper half
   of the rug, so the pieces in front of it stay in front. */
const FEET_ABOVE_RUG = 30

/* The room's size and landmarks in room units; the overrun is the floor
   that runs on below the plate's edge when a view is wider than the plate
   is tall. */
export const ROOM = {
  width: PLATE.width,
  height: PLATE.height,
  floorY: PLATE.floorY,
  elfAnchor: { x: PLATE.rug.x, y: PLATE.rug.y - FEET_ABOVE_RUG },
  overrun: 400,
} as const

/* The fire in the plate's hearth and how far its glow reaches, room
   units: the light painted over the plate breathes there. */
export const HEARTH = { x: PLATE.hearth.x, y: PLATE.hearth.y, reach: PLATE.fireplace.width * 1.9 } as const

/* How the room maps onto a view: view = room * scale + offset. */
export type RoomLayout = { scale: number; offsetX: number; offsetY: number }

/* The cover fit into the band of the view between topInset and
   bottomInset: the larger of the two ratios, centred on both axes of that
   band, or, given a focus (a room point), moved as far as the band allows
   towards having the focus in the band's middle, so a short band (an
   open catalogue) still shows the piece being chosen for. */
export function fitRoom(viewWidth: number, viewHeight: number, topInset = 0, bottomInset = 0, focus: { x: number; y: number } | null = null): RoomLayout {
  const free = Math.max(1, viewHeight - topInset - bottomInset)
  const scale = Math.max(viewWidth / ROOM.width, free / ROOM.height)
  const width = ROOM.width * scale
  const height = ROOM.height * scale
  const centred = { x: (viewWidth - width) / 2, y: topInset + (free - height) / 2 }
  if (!focus) return { scale, offsetX: centred.x, offsetY: centred.y }
  const clampTo = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))
  return {
    scale,
    offsetX: clampTo(viewWidth / 2 - focus.x * scale, viewWidth - width, 0),
    offsetY: clampTo(topInset + free / 2 - focus.y * scale, topInset + free - height, topInset),
  }
}

/* A point in the view (e.g. a tap) in room units. */
export function toRoom(layout: RoomLayout, x: number, y: number): { x: number; y: number } {
  const scale = layout.scale || 1
  return { x: (x - layout.offsetX) / scale, y: (y - layout.offsetY) / scale }
}

/* A rectangle in room units, relative to some anchor. */
export type Bounds = { x: number; y: number; width: number; height: number }

/* Whether a room point lies inside bounds placed at an anchor. */
export function inBounds(point: { x: number; y: number }, anchor: { x: number; y: number }, bounds: Bounds): boolean {
  const left = anchor.x + bounds.x
  const top = anchor.y + bounds.y
  return point.x >= left && point.x <= left + bounds.width && point.y >= top && point.y <= top + bounds.height
}

/* The depth layer of an item: 'back' is on the wall (drawn before the rug
   and the elf), 'mid' on the floor behind the elf, 'front' on the floor
   before it. */
export type SlotZ = 'back' | 'mid' | 'front'
export const SLOT_ZS: readonly SlotZ[] = ['back', 'mid', 'front']

/* Where an item stands: the anchor is its base centre in room units (the
   bottom of a frame, the feet of a stool, the point where a hanging thing
   ends), and the item draws itself around that point. The hit box is the
   tap target of the slot, room units around the anchor. */
export type Slot = { id: SlotId; x: number; y: number; z: SlotZ; hit: Bounds }

/* The places of the cottage in drawing order within each layer: the wall
   and the floor first (the plate draws them; a tap finds them only where
   no piece lies over them), the window over the bed on the left, the
   fireplace on the right, the small things hanging and standing between
   them; the rug is first of the floor items so everything else lies on
   it. */
const SLOT_LAYERS: readonly { id: SlotId; z: SlotZ }[] = [
  { id: 'wall', z: 'back' },
  { id: 'floor', z: 'back' },
  { id: 'window', z: 'back' },
  { id: 'herbs', z: 'back' },
  { id: 'shelf', z: 'back' },
  { id: 'lantern', z: 'back' },
  { id: 'picture', z: 'back' },
  { id: 'fireplace', z: 'back' },
  { id: 'rug', z: 'mid' },
  { id: 'bed', z: 'mid' },
  { id: 'basket', z: 'mid' },
  { id: 'fern', z: 'front' },
  { id: 'candle', z: 'front' },
]

/* A slot anchored at the base centre of its box in the plate. */
function slotOn(id: SlotId, z: SlotZ, box: PlateBox): Slot {
  const x = box.x + box.width / 2
  const y = box.y + box.height
  return { id, x, y, z, hit: { x: box.x - x, y: box.y - y, width: box.width, height: box.height } }
}

/* The plate's own box for a place: the fireplace, the wall, the floor. */
const PLATE_BOXES: Partial<Record<SlotId, PlateBox>> = { fireplace: PLATE.fireplace, wall: PLATE.wall, floor: PLATE.floor }

export const SLOTS: readonly Slot[] = SLOT_LAYERS.map(({ id, z }) => {
  const box = PLATE_BOXES[id] ?? PLATE.sprites.find((sprite) => sprite.slot === id && sprite.default) ?? PLATE.sprites.find((sprite) => sprite.slot === id)
  if (!box) throw new Error(`The room manifest has no render for the slot ${id}`)
  return slotOn(id, z, box)
})

/* The slots of one layer, in drawing order. */
export function slotsIn(z: SlotZ): readonly Slot[] {
  return SLOTS.filter((slot) => slot.z === z)
}

/* The slot with that id; every SlotId has one. */
export function slotById(id: SlotId): Slot {
  const slot = SLOTS.find((candidate) => candidate.id === id)
  if (!slot) throw new Error(`Unknown slot: ${id}`)
  return slot
}

/* The topmost slot under a room point in a slot table: the front layer
   first, then the middle, then the wall, and within a layer the item
   drawn last (which lies on top of its neighbours). Slots the filter
   refuses are skipped, so the caller can leave out the fireplace in edit
   mode or the rug under the elf. The table is the rendered room's
   (roomAssets.spriteSlotsFor), or SLOTS itself. */
export function slotAtIn(slots: readonly Slot[], point: { x: number; y: number }, accept: (slot: Slot) => boolean = () => true): Slot | null {
  for (const z of ['front', 'mid', 'back'] as const) {
    const layer = slots.filter((slot) => slot.z === z)
    for (let index = layer.length - 1; index >= 0; index -= 1) {
      const slot = layer[index]!
      if (accept(slot) && inBounds(point, slot, slot.hit)) return slot
    }
  }
  return null
}
