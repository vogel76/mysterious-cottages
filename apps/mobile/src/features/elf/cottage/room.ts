/* The cottage room's coordinate contract. The room is designed once in
   "room units", a portrait canvas 1000 wide and 1600 tall, and the scene
   scales it to cover whatever view it gets (the way a background image
   covers a screen), centred both ways; a narrow phone crops up to about a
   fifth of each side, a short one a little of the top and bottom. Every
   drawing in the cottage (the room shell, the furniture, the elf, the
   lights) is laid out in these units and never knows the view's size; the
   layout here is the only place that converts between the two.

   The head-up display of the Elf tab covers roughly the top 260 and the
   bottom 300 units, so the elf and the heart of the room live in the band
   between. The floor meets the wall at y 1150, the elf stands on the rug
   with its feet at (500, 1240), and everything important stays within
   x 120..880 so no phone crops it away. The slots place each piece of
   furniture by its base centre and say in which depth layer it is drawn:
   on the wall behind everything, on the floor behind the elf, or on the
   floor in front of it. Each slot also carries its tap target: the box,
   around the anchor, that a finger has to land in to pick the slot in edit
   mode or to poke the item out of it; it is the union of the slot's
   variants with a little slack, so a swapped item never falls out of it.
   The variants themselves live in ./items; this module only names them by
   their slot (a type-only import, so there is no cycle at runtime).

   The floor and the light overlays run on below the room's bottom edge by
   the overrun: the scene lifts the room while a panel is open at the
   bottom of the tab, so the elf and the furniture stay in view above it,
   and what comes up from under the edge must still be floor. */

import type { SlotId } from './items'

/* The elf stands on the upper half of the rug, so the action bar at the
   bottom of the screen clears its feet. */
export const ROOM = { width: 1000, height: 1600, floorY: 1150, elfAnchor: { x: 500, y: 1240 }, overrun: 600 } as const

/* How the room maps onto a view: view = room * scale + offset. */
export type RoomLayout = { scale: number; offsetX: number; offsetY: number }

/* The cover fit: the larger of the two ratios, centred on both axes. */
export function fitRoom(viewWidth: number, viewHeight: number): RoomLayout {
  const scale = Math.max(viewWidth / ROOM.width, viewHeight / ROOM.height)
  return {
    scale,
    offsetX: (viewWidth - ROOM.width * scale) / 2,
    offsetY: (viewHeight - ROOM.height * scale) / 2,
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

/* The furniture of the cottage in drawing order within each layer. The
   window sits centre-left with the night outside, the fireplace fills the
   right wall, the small things hang and stand between them; the rug is
   first of the floor items so everything else lies on it. */
export const SLOTS: readonly Slot[] = [
  { id: 'window', x: 320, y: 760, z: 'back', hit: { x: -215, y: -380, width: 430, height: 460 } },
  { id: 'herbs', x: 540, y: 430, z: 'back', hit: { x: -90, y: -150, width: 180, height: 170 } },
  { id: 'shelf', x: 530, y: 570, z: 'back', hit: { x: -110, y: -120, width: 220, height: 160 } },
  { id: 'lantern', x: 810, y: 400, z: 'back', hit: { x: -70, y: -300, width: 140, height: 320 } },
  { id: 'picture', x: 740, y: 600, z: 'back', hit: { x: -90, y: -150, width: 180, height: 170 } },
  { id: 'fireplace', x: 740, y: 1150, z: 'back', hit: { x: -190, y: -530, width: 380, height: 610 } },
  { id: 'rug', x: ROOM.elfAnchor.x, y: 1290, z: 'mid', hit: { x: -335, y: -145, width: 670, height: 275 } },
  { id: 'bed', x: 230, y: 1200, z: 'mid', hit: { x: -180, y: -260, width: 360, height: 300 } },
  { id: 'basket', x: 640, y: 1235, z: 'mid', hit: { x: -90, y: -150, width: 180, height: 170 } },
  { id: 'fern', x: 160, y: 1450, z: 'front', hit: { x: -170, y: -310, width: 340, height: 335 } },
  { id: 'candle', x: 800, y: 1420, z: 'front', hit: { x: -130, y: -330, width: 260, height: 360 } },
]

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
   mode or the rug under the elf. The table is SLOTS for the vector room,
   or the rendered room's table (roomAssets.spriteSlotsFor). */
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
