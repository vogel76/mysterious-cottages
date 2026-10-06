import type { SkImage } from '@shopify/react-native-skia'
import { useSpriteClock } from './clock'
import type { SpriteManifest } from './manifest'
import { SpriteFrame } from './SpriteFrame'

/* One sprite of one layer with its own clock: the elf's body alone, a
   piece of furniture with an idle, a particle burst. Mount it inside a
   Skia Canvas. For a character made of several layers (body, face, hat)
   use LayeredSprite, which shares one clock among them. */

export type SpritePlayerProps = {
  manifest: SpriteManifest
  /* The decoded sheets of the layer (useSpriteImages). */
  sheets: SkImage[]
  layer?: string
  clip: string
  playing: boolean
  /* Overrides the manifest's loop flag of the clip. */
  loop?: boolean
  /* A one-shot clip reached its last frame. */
  onEnd?: () => void
  /* Where the feet go, in canvas pixels. */
  x: number
  y: number
  scale: number
  flipX?: boolean
}

export function SpritePlayer({ manifest, sheets, layer, clip, playing, loop, onEnd, x, y, scale, flipX }: SpritePlayerProps) {
  const frame = useSpriteClock({ manifest, clip, playing, loop, onEnd })
  return <SpriteFrame manifest={manifest} sheets={sheets} layer={layer} frame={frame} x={x} y={y} scale={scale} flipX={flipX} />
}
