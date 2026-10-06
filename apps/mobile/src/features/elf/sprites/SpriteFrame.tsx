import { memo } from 'react'
import { Atlas, FilterMode, Group, MipmapMode, useRSXformBuffer, useRectBuffer, type SkImage } from '@shopify/react-native-skia'
import type { SharedValue } from 'react-native-reanimated'
import { sheetsOf, type SpriteManifest, type SpriteSheet } from './manifest'

/* Draws the current frame of one layer: the cell the frame clock points
   at, placed so the character's feet land on (x, y), scaled, optionally
   mirrored. One Atlas node per sheet, each with a one-sprite buffer: the
   cell rectangle and the placement are Skia buffers driven by the frame
   value, so a frame change is computed on the UI thread and touches no
   React tree. A sheet that does not hold the current frame gets an empty
   cell, which draws nothing. The Atlas node is used rather than Image
   because Image has no source rectangle: cutting one cell out of a sheet
   with it takes a clip and a translated image, two transforms to keep in
   step per frame, where Atlas takes the cell and the placement directly.
   The mirror is a static group transform around the feet; the sheets hold
   the character facing the camera's left-of-centre, and the scene flips
   it to look the other way. */

export type SpriteFrameProps = {
  manifest: SpriteManifest
  /* The decoded sheets of the layer, in the manifest's order. */
  sheets: SkImage[]
  /* An overlay of the manifest; the base layer when omitted. */
  layer?: string
  /* The global frame index, from useSpriteClock. */
  frame: SharedValue<number>
  /* Where the feet go, in canvas pixels. */
  x: number
  y: number
  scale: number
  flipX?: boolean
}

const SAMPLING = { filter: FilterMode.Linear, mipmap: MipmapMode.None }

type SheetAtlasProps = {
  image: SkImage
  sheet: SpriteSheet
  /* The global index of the sheet's first frame. */
  first: number
  width: number
  height: number
  frame: SharedValue<number>
  left: number
  top: number
  scale: number
}

function SheetAtlas({ image, sheet, first, width, height, frame, left, top, scale }: SheetAtlasProps) {
  const columns = sheet.columns
  const count = sheet.frames
  const sprites = useRectBuffer(1, (rect) => {
    'worklet'
    const cell = frame.value - first
    if (cell < 0 || cell >= count) {
      rect.setXYWH(0, 0, 0, 0)
    } else {
      rect.setXYWH((cell % columns) * width, Math.floor(cell / columns) * height, width, height)
    }
  })
  const transforms = useRSXformBuffer(1, (transform) => {
    'worklet'
    transform.set(scale, 0, left, top)
  })
  return <Atlas image={image} sprites={sprites} transforms={transforms} sampling={SAMPLING} />
}

export const SpriteFrame = memo(function SpriteFrame({ manifest, sheets, layer, frame, x, y, scale, flipX }: SpriteFrameProps) {
  const grid = sheetsOf(manifest, layer)
  const left = x - manifest.anchor.x * scale
  const top = y - manifest.anchor.y * scale
  let first = 0
  const atlases = grid.map((sheet, index) => {
    const image = sheets[index]
    const start = first
    first += sheet.frames
    if (!image) return null
    return (
      <SheetAtlas
        key={sheet.file}
        image={image}
        sheet={sheet}
        first={start}
        width={manifest.frameWidth}
        height={manifest.frameHeight}
        frame={frame}
        left={left}
        top={top}
        scale={scale}
      />
    )
  })
  if (!flipX) return <>{atlases}</>
  return <Group transform={[{ translateX: x }, { scaleX: -1 }, { translateX: -x }]}>{atlases}</Group>
})
