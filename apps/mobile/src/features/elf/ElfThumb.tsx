import { memo, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { Canvas, Group, Image, useImage } from '@shopify/react-native-skia'
import { PHOTO_ID, type SlotId } from './cottage/catalogue'
import { FramedPhoto } from './cottage/RoomSprites'
import { roomSpriteFor, type RoomSprite } from './cottage/roomAssets'

/* One thumbnail of the decorating panel: a small Skia canvas that shows
   the rendered crop of a piece of furniture (cottage/roomAssets), the very
   picture the room draws, fitted into a padded square and centred (the
   sprite is drawn at its own room box under one transform, which keeps
   its proportions, all the room itself does with it), so the player sees
   the real thing before choosing it; the live preview is the room behind
   the panel. The frame's photo id draws the latest cottage's photo into
   the frame the way the room does. The crops are small (a few hundred
   pixels a side), so Skia's useImage decoding them per thumbnail is
   cheap, unlike the elf's sheets, which are shared. The panel mounts only
   the active slot's strip, so a handful of canvases exist at a time. An
   id without a render shows an empty square; the panel never offers one. */

export const THUMB_SIZE = 72
const PADDING = 6
const INNER = THUMB_SIZE - 2 * PADDING

export type ElfThumbProps = {
  slot: SlotId
  id: string
  /* The latest cottage's picture, for the frame's photo id. */
  photo?: string | null
}

export const ElfThumb = memo(function ElfThumb({ slot, id, photo = null }: ElfThumbProps) {
  const sprite = roomSpriteFor(slot, id)
  const framed = slot === 'picture' && id === PHOTO_ID ? photo : null
  return <View style={styles.thumb}>{sprite ? <SpriteThumb sprite={sprite} photo={framed} /> : null}</View>
})

function SpriteThumb({ sprite, photo }: { sprite: RoomSprite; photo: string | null }) {
  const image = useImage(sprite.module)
  const { x, y, width, height } = sprite
  const transform = useMemo(() => {
    const scale = Math.min(INNER / Math.max(1, width), INNER / Math.max(1, height))
    const fitted = { width: width * scale, height: height * scale }
    return [{ translateX: (THUMB_SIZE - fitted.width) / 2 - x * scale }, { translateY: (THUMB_SIZE - fitted.height) / 2 - y * scale }, { scale }]
  }, [x, y, width, height])
  return (
    <Canvas style={styles.canvas}>
      <Group transform={transform}>
        {image ? <Image image={image} fit="fill" x={x} y={y} width={width} height={height} /> : null}
        {photo ? <FramedPhoto sprite={sprite} uri={photo} /> : null}
      </Group>
    </Canvas>
  )
}

const styles = StyleSheet.create({
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
  canvas: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
})
