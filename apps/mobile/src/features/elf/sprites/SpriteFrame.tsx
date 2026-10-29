import { memo } from 'react'
import { Atlas, FilterMode, Group, MipmapMode, Skia, type SkImage } from '@shopify/react-native-skia'
import { useDerivedValue, type SharedValue } from 'react-native-reanimated'
import { cellOf, sheetsOf, type SpriteManifest, type SpriteSheet } from './manifest'

/* Draws the current frame of one layer: the cell the frame clock points
   at, placed so the character's feet land on (x, y), scaled, optionally
   mirrored. One Atlas node per sheet, each drawing one sprite: the cell
   rectangle and the placement are values derived from the frame value,
   so a frame change is computed on the UI thread and touches no React
   tree, and only the sheet that holds the frame builds a rectangle; a
   sheet that does not hold it gets an empty cell, which draws nothing.
   The nodes belong to one atlas (keyed by it) and their first rectangle
   and placement are computed as they mount: a derived value changed
   later catches up on the UI thread a frame after the image does, so a
   node reused for another atlas (the elf reaching a new form, another
   hat) would draw one frame of the new sheet cut by the old grid. The Atlas node is used rather than Image
   because Image has no source rectangle: cutting one cell out of a sheet
   with it takes a clip and a translated image, two transforms to keep in
   step per frame, where Atlas takes the cell and the placement directly.
   An overlay's cells are of its own size, drawn at its offset from the
   base cell. The mirror is a static group transform around the feet; the sheets hold
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
const NO_CELL = [Skia.XYWHRect(0, 0, 0, 0)]

/* A key per manifest, so each atlas gets nodes of its own. */
const atlasKeys = new WeakMap<SpriteManifest, number>()
let nextAtlasKey = 0
function atlasKey(manifest: SpriteManifest): number {
  let key = atlasKeys.get(manifest)
  if (key === undefined) {
    key = nextAtlasKey++
    atlasKeys.set(manifest, key)
  }
  return key
}

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
  const sprites = useDerivedValue(() => {
    const cell = frame.value - first
    if (cell < 0 || cell >= count) return NO_CELL
    return [Skia.XYWHRect((cell % columns) * width, Math.floor(cell / columns) * height, width, height)]
  })
  const transforms = useDerivedValue(() => [Skia.RSXform(scale, 0, left, top)])
  return <Atlas image={image} sprites={sprites} transforms={transforms} sampling={SAMPLING} />
}

export const SpriteFrame = memo(function SpriteFrame({ manifest, sheets, layer, frame, x, y, scale, flipX }: SpriteFrameProps) {
  const grid = sheetsOf(manifest, layer)
  const cell = cellOf(manifest, layer)
  const left = x + (cell.x - manifest.anchor.x) * scale
  const top = y + (cell.y - manifest.anchor.y) * scale
  const atlas = atlasKey(manifest)
  let first = 0
  const atlases = grid.map((sheet, index) => {
    const image = sheets[index]
    const start = first
    first += sheet.frames
    if (!image) return null
    return (
      <SheetAtlas
        key={`${atlas}:${sheet.file}`}
        image={image}
        sheet={sheet}
        first={start}
        width={cell.width}
        height={cell.height}
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
