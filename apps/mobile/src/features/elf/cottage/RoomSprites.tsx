import { Fragment, memo } from 'react'
import { FilterMode, Group, Image, MipmapMode, Rect, rect, useImage } from '@shopify/react-native-skia'
import type { SharedValue } from 'react-native-reanimated'
import { PHOTO_ID, type Decor } from './catalogue'
import { ROOM, slotsIn, type SlotZ } from './room'
import { ROOM_PLATE, ROOM_PLATE_DAY, photoRect, roomSpriteFor, type RoomSprite } from './roomAssets'

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
   into the plate and has no sprite of its own. The frame on the wall can
   show the expedition's photo of the latest cottage found (the decor's
   photo id): the frame's render first, then the photo clipped to the
   picture inside it, and the render's own picture until the photo has
   decoded.

   The plate and each sprite are rendered by night and by day, and the
   daytime picture is drawn over the night one at the opacity of the
   clock's daylight (0 at night, 1 in full day), so the room's light turns
   with the hour on the UI thread, nothing re-rendered.

   Each image is decoded once by useImage when its node mounts and kept
   while the node lives; a sprite node is keyed by its slot, so swapping a
   variant reuses the node and keeps the old picture on screen until the
   new one is in (useImage holds the previous value while it loads).
   Nothing here changes per frame: the scene's transform group moves the
   room, and the light is painted on top by the lighting layer. */

export type RoomSpritesProps = {
  decor: Decor
  layer: SlotZ
  /* Daylight, 0 night .. 1 full day; the day renders fade in with it. */
  day: SharedValue<number>
  /* The latest cottage found, as a picture URI, for the frame's photo id. */
  photo?: string | null
}

/* The plate's own colours, for what stands in for it and runs under it. */
const WALL_COLOUR = '#3a1804'
const PLANK_COLOUR = '#55443f'

/* Linear with mipmaps: the renders are drawn a little smaller than their
   pixels on most phones, and plain linear sampling would shimmer. */
const SAMPLING = { filter: FilterMode.Linear, mipmap: MipmapMode.Linear }

function Plate({ day }: { day: SharedValue<number> }) {
  const image = useImage(ROOM_PLATE)
  const dayImage = useImage(ROOM_PLATE_DAY)
  return (
    <>
      {image ? (
        <Image image={image} x={0} y={0} width={ROOM.width} height={ROOM.height} fit="fill" sampling={SAMPLING} />
      ) : (
        <Rect x={0} y={0} width={ROOM.width} height={ROOM.height} color={WALL_COLOUR} />
      )}
      {dayImage ? (
        <Group opacity={day}>
          <Image image={dayImage} x={0} y={0} width={ROOM.width} height={ROOM.height} fit="fill" sampling={SAMPLING} />
        </Group>
      ) : null}
      <Rect x={0} y={ROOM.height} width={ROOM.width} height={ROOM.overrun} color={PLANK_COLOUR} />
    </>
  )
}

function Sprite({ sprite, day }: { sprite: RoomSprite; day: SharedValue<number> }) {
  const image = useImage(sprite.module)
  const dayImage = useImage(sprite.moduleDay)
  if (!image) return null
  return (
    <>
      <Image image={image} x={sprite.x} y={sprite.y} width={sprite.width} height={sprite.height} fit="fill" sampling={SAMPLING} />
      {dayImage ? (
        <Group opacity={day}>
          <Image image={dayImage} x={sprite.x} y={sprite.y} width={sprite.width} height={sprite.height} fit="fill" sampling={SAMPLING} />
        </Group>
      ) : null}
    </>
  )
}

/* The expedition's photo inside the frame's render, clipped to the
   picture area and covering it; nothing until it has decoded. Shared with
   the decorating panel's thumbnail. */
export function FramedPhoto({ sprite, uri }: { sprite: RoomSprite; uri: string }) {
  const image = useImage(uri)
  const area = photoRect(sprite)
  if (!image) return null
  return (
    <Group clip={rect(area.x, area.y, area.width, area.height)}>
      <Image image={image} x={area.x} y={area.y} width={area.width} height={area.height} fit="cover" sampling={SAMPLING} />
    </Group>
  )
}

export const RoomSprites = memo(function RoomSprites({ decor, layer, day, photo = null }: RoomSpritesProps) {
  return (
    <>
      {layer === 'back' ? <Plate day={day} /> : null}
      {slotsIn(layer).map((slot) => {
        const sprite = roomSpriteFor(slot.id, decor[slot.id])
        if (!sprite) return null
        const framed = slot.id === 'picture' && decor.picture === PHOTO_ID ? photo : null
        return (
          <Fragment key={slot.id}>
            <Sprite sprite={sprite} day={day} />
            {framed ? <FramedPhoto sprite={sprite} uri={framed} /> : null}
          </Fragment>
        )
      })}
    </>
  )
})
