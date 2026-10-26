import { memo, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { Canvas, Image, useImage } from '@shopify/react-native-skia'
import type { SlotId } from './cottage/catalogue'
import { roomSpriteFor } from './cottage/roomAssets'

/* One thumbnail of the decorating panel: a small Skia canvas that shows
   the rendered crop of a piece of furniture (cottage/roomAssets), the very
   picture the room draws, fitted into a padded square and centred (the
   Image node's contain fit keeps its proportions, which is all the room
   itself does with it), so the player sees the real thing before choosing
   it; the live preview is the room behind the panel. The crops are small
   (a few hundred pixels a side), so Skia's useImage decoding them per
   thumbnail is cheap, unlike the elf's sheets, which are shared. The panel
   mounts only the active slot's strip, so a handful of canvases exist at a
   time. An id without a render shows an empty square; the panel never
   offers one. */

export const THUMB_SIZE = 72
const PADDING = 6
const INNER = THUMB_SIZE - 2 * PADDING

export type ElfThumbProps = { slot: SlotId; id: string }

export const ElfThumb = memo(function ElfThumb({ slot, id }: ElfThumbProps) {
  const sprite = roomSpriteFor(slot, id)
  return <View style={styles.thumb}>{sprite ? <SpriteThumb module={sprite.module} width={sprite.width} height={sprite.height} /> : null}</View>
})

function SpriteThumb({ module, width, height }: { module: number; width: number; height: number }) {
  const image = useImage(module)
  const rect = useMemo(() => {
    const scale = Math.min(INNER / Math.max(1, width), INNER / Math.max(1, height))
    const fitted = { width: width * scale, height: height * scale }
    return { x: (THUMB_SIZE - fitted.width) / 2, y: (THUMB_SIZE - fitted.height) / 2, ...fitted }
  }, [width, height])
  return <Canvas style={styles.canvas}>{image ? <Image image={image} fit="contain" x={rect.x} y={rect.y} width={rect.width} height={rect.height} /> : null}</Canvas>
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
