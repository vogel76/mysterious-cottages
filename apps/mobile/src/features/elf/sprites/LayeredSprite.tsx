import type { SkImage } from '@shopify/react-native-skia'
import { useSpriteClock } from './clock'
import type { SpriteManifest } from './manifest'
import { SpriteFrame } from './SpriteFrame'

/* A character of several layers drawn from one frame clock: the body,
   then the face of the current mood, then the hat, each a layer of the
   same manifest packed with the same grid. Because every layer reads the
   same shared frame value, they can never drift apart, not even by a
   frame. The layers draw in the order given, the first at the bottom. */

export type SpriteLayer = {
  /* An overlay of the manifest; the base layer when omitted. */
  layer?: string
  sheets: SkImage[]
}

export type LayeredSpriteProps = {
  manifest: SpriteManifest
  layers: SpriteLayer[]
  clip: string
  playing: boolean
  loop?: boolean
  onEnd?: () => void
  x: number
  y: number
  scale: number
  flipX?: boolean
}

export function LayeredSprite({ manifest, layers, clip, playing, loop, onEnd, x, y, scale, flipX }: LayeredSpriteProps) {
  const frame = useSpriteClock({ manifest, clip, playing, loop, onEnd })
  return (
    <>
      {layers.map(({ layer, sheets }) => (
        <SpriteFrame key={layer ?? 'body'} manifest={manifest} sheets={sheets} layer={layer} frame={frame} x={x} y={y} scale={scale} flipX={flipX} />
      ))}
    </>
  )
}
