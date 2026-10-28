import { memo, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { Image as PictureImage } from 'expo-image'
import { Canvas, Group, Image, useImage } from '@shopify/react-native-skia'
import { PHOTO_ID, isSurface, type SlotId } from './cottage/catalogue'
import { SPRITE_CHARACTERS, thumbModule } from './sprites'
import { FramedPhoto } from './cottage/RoomSprites'
import { roomSpriteFor, surfaceThumbFor, type RoomSprite } from './cottage/roomAssets'

/* The picture of a piece on a card of the decorating catalogue: the
   piece's catalogue render (art/blender/room.py renders every piece a
   second time close up and by day, so a card is sharp at its size) as a
   plain image, fitted into the square and centred; a wall or a floor
   shows its patch, filling the square, and a hat the elf's head wearing
   it (the wardrobe's pictures, packed with the elf's atlas). A plain
   image, not a Skia canvas:
   a canvas per card is a surface of its own on the GPU, and the
   measurement showed a row of them in the graphics memory. Only the
   frame's photo card draws on a canvas, since it lays the latest
   cottage's photo into the frame's render the way the room does; a piece
   without a catalogue render falls back to the same canvas with the
   room's own crop. An id without a render shows an empty square; the
   catalogue never offers one. */

const PADDING_SHARE = 0.08
const ELF = SPRITE_CHARACTERS.elf

export type ElfThumbProps = {
  /* A place of the room, or the elf's hat. */
  slot: SlotId | 'hat'
  id: string
  /* The side of the square, points. */
  size: number
  /* The latest cottage's picture, for the frame's photo id. */
  photo?: string | null
}

export const ElfThumb = memo(function ElfThumb({ slot, id, size, photo = null }: ElfThumbProps) {
  if (slot === 'hat') {
    const thumb = ELF ? thumbModule(ELF, `hat_${id}`) : null
    return <View style={{ width: size, height: size }}>{thumb !== null ? <CatalogueThumb module={thumb} size={size} /> : null}</View>
  }
  if (isSurface(slot)) {
    const thumb = surfaceThumbFor(slot, id)
    return <View style={{ width: size, height: size }}>{thumb !== null ? <CatalogueThumb module={thumb} size={size} fill /> : null}</View>
  }
  const sprite = roomSpriteFor(slot, id)
  const framed = slot === 'picture' && id === PHOTO_ID ? photo : null
  const box = { width: size, height: size }
  if (!sprite) return <View style={box} />
  return (
    <View style={box}>
      {sprite.moduleThumb !== null && !framed ? <CatalogueThumb module={sprite.moduleThumb} size={size} /> : <SpriteThumb sprite={sprite} photo={framed} size={size} />}
    </View>
  )
})

/* The close-up render, fitted with a margin, or filling the square. */
function CatalogueThumb({ module, size, fill = false }: { module: number; size: number; fill?: boolean }) {
  const inner = fill ? size : size * (1 - 2 * PADDING_SHARE)
  return (
    <View style={[styles.centre, { width: size, height: size }]}>
      <PictureImage source={module} contentFit={fill ? 'cover' : 'contain'} style={{ width: inner, height: inner }} />
    </View>
  )
}

/* The room's crop of the piece, drawn at its own room box under one
   transform that fits it into the square (the frame's photo with it). */
function SpriteThumb({ sprite, photo, size }: { sprite: RoomSprite; photo: string | null; size: number }) {
  const image = useImage(sprite.module)
  const { x, y, width, height } = sprite
  const transform = useMemo(() => {
    const inner = size * (1 - 2 * PADDING_SHARE)
    const scale = Math.min(inner / Math.max(1, width), inner / Math.max(1, height))
    const fitted = { width: width * scale, height: height * scale }
    return [{ translateX: (size - fitted.width) / 2 - x * scale }, { translateY: (size - fitted.height) / 2 - y * scale }, { scale }]
  }, [x, y, width, height, size])
  return (
    <Canvas style={[styles.canvas, { width: size, height: size }]}>
      <Group transform={transform}>
        {image ? <Image image={image} fit="fill" x={x} y={y} width={width} height={height} /> : null}
        {photo ? <FramedPhoto sprite={sprite} uri={photo} /> : null}
      </Group>
    </Canvas>
  )
}

const styles = StyleSheet.create({
  centre: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    backgroundColor: 'transparent',
  },
})
