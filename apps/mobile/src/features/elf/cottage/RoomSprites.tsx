import { memo } from 'react'
import { FilterMode, Image, MipmapMode, Rect, useImage } from '@shopify/react-native-skia'
import type { Decor } from './items'
import { ROOM, slotsIn, type SlotZ } from './room'
import { ROOM_PLATE, roomSpriteFor, type RoomSprite } from './roomAssets'

/* The rendered room inside the room group: the plate (the empty cottage,
   fireplace and all) covering the room exactly, and the furniture of the
   decor as transparent crops laid at the boxes the room manifest gives
   them, in the depth layers of ./room so the scene can put the elf (or
   the egg) between the floor pieces behind it and the ones before it.
   The back layer carries the plate; while it is still decoding a flat
   wall colour stands in for it, and below the room's bottom edge a solid
   plank colour runs on by the room's overrun, so the lift behind an open
   panel never shows bare canvas. A sprite that is still decoding, or one
   the manifest has no render for, draws nothing; the fireplace is baked
   into the plate and has no sprite of its own.

   Each image is decoded once by useImage when its node mounts and kept
   while the node lives; a sprite node is keyed by its slot, so swapping a
   variant reuses the node and keeps the old picture on screen until the
   new one is in (useImage holds the previous value while it loads).
   Nothing here changes per frame: the scene's transform group moves the
   room, and the light is painted on top by the lighting layer. */

export type RoomSpritesProps = {
  decor: Decor
  layer: SlotZ
}

/* The plate's own colours, for what stands in for it and runs under it. */
const WALL_COLOUR = '#3a1804'
const PLANK_COLOUR = '#55443f'

/* Linear with mipmaps: the renders are drawn a little smaller than their
   pixels on most phones, and plain linear sampling would shimmer. */
const SAMPLING = { filter: FilterMode.Linear, mipmap: MipmapMode.Linear }

function Plate() {
  const image = useImage(ROOM_PLATE)
  return (
    <>
      {image ? (
        <Image image={image} x={0} y={0} width={ROOM.width} height={ROOM.height} fit="fill" sampling={SAMPLING} />
      ) : (
        <Rect x={0} y={0} width={ROOM.width} height={ROOM.height} color={WALL_COLOUR} />
      )}
      <Rect x={0} y={ROOM.height} width={ROOM.width} height={ROOM.overrun} color={PLANK_COLOUR} />
    </>
  )
}

function Sprite({ sprite }: { sprite: RoomSprite }) {
  const image = useImage(sprite.module)
  if (!image) return null
  return <Image image={image} x={sprite.x} y={sprite.y} width={sprite.width} height={sprite.height} fit="fill" sampling={SAMPLING} />
}

export const RoomSprites = memo(function RoomSprites({ decor, layer }: RoomSpritesProps) {
  return (
    <>
      {layer === 'back' ? <Plate /> : null}
      {slotsIn(layer).map((slot) => {
        const sprite = roomSpriteFor(slot.id, decor[slot.id])
        return sprite ? <Sprite key={slot.id} sprite={sprite} /> : null
      })}
    </>
  )
})
