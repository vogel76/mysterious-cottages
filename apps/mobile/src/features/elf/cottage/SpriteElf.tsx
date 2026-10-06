import { useMemo } from 'react'
import { Group, Oval, RadialGradient, vec } from '@shopify/react-native-skia'
import { useDerivedValue } from 'react-native-reanimated'
import { LayeredSprite, type SpriteImages, type SpriteLayer, type SpriteManifest } from '../sprites'
import type { PuppetMotion } from './motion'
import type { Bounds } from './room'

/* The elf as the rendered sprite (art/blender/elf.py, packed into the
   atlases of assets/elf/sprites/elf): the body layer alone for now, the
   face and the hood baked in, played by the clip the scene names. The
   figure's feet land on the origin, in room units, and the cell is scaled
   so the figure stands ELF_HEIGHT_UNITS tall. The baked animation is the
   elf's own acting (the idle sway and blinks, the pat, the meal, the
   wave); over it the cottage's procedural life still plays through a
   group transform bound to the motion values: the hop (bob) lifts the
   whole figure, the lean (tilt, with a share of the head's tilt, so the
   elf still inclines towards a finger that strokes it) rotates it around
   the feet, and the squash scales it the way the puppet's body scaled.
   A soft shadow pools under the feet and thins as the elf hops.

   The frame clock restarts when the clip name changes; to play the same
   one-shot clip twice in a row the scene changes clipKey, which remounts
   the player and its clock. Nothing here is rebuilt per frame: the clock
   advances a shared value, the atlases read it. */

/* The figure's height on screen, room units; the owner tunes this. */
export const ELF_HEIGHT_UNITS = 540
/* Where the feet stand in sprite mode: the upper half of the rendered
   rug, whose centre is (500, 1280). */
export const SPRITE_ELF_ORIGIN = { x: 500, y: 1240 } as const
/* The figure's height in cell pixels: the model is 1.965 m to the hood's
   tip and the cell has 180 px to the metre. */
const FIGURE_CELL_PX = 354
export const SPRITE_ELF_SCALE = ELF_HEIGHT_UNITS / FIGURE_CELL_PX
/* How much of the head's tilt (the gaze, the stroke's lean) the whole
   figure takes, since the sprite has no separate head to turn. */
const HEAD_LEAN = 0.3
/* Above this line, measured from the feet, a tap lands on the head. */
export const SPRITE_ELF_HEAD_LINE = 0.58 * ELF_HEIGHT_UNITS

const SHADOW = { rx: 150, ry: 32, opacity: 0.3 } as const

/* The tap target, room units around the feet: the figure itself, not the
   atlas cell, whose transparent margins would otherwise swallow the
   basket, the bed's edge and the window's corner next to the elf. The
   figure is about 0.6 of its height wide at the arms; the box reaches a
   little under the feet and just over the hood's tip. */
export const SPRITE_ELF_HIT_BOX: Bounds = { x: -0.3 * ELF_HEIGHT_UNITS, y: -1.04 * ELF_HEIGHT_UNITS, width: 0.6 * ELF_HEIGHT_UNITS, height: 1.08 * ELF_HEIGHT_UNITS }

export type SpriteElfProps = {
  clip: string
  /* Changes to restart the clip even when its name stays the same. */
  clipKey?: number
  /* A one-shot clip reached its last frame. */
  onClipEnd: () => void
  playing: boolean
  motion: PuppetMotion
  /* The feet, room units. */
  origin: { x: number; y: number }
  images: SpriteImages
  manifest: SpriteManifest
  flipX?: boolean
}

export function SpriteElf({ clip, clipKey = 0, onClipEnd, playing, motion, origin, images, manifest, flipX }: SpriteElfProps) {
  const { bob, squash, tilt, headTilt } = motion
  const { x, y } = origin
  const transform = useDerivedValue(
    () => [
      { translateX: x },
      { translateY: y + bob.value },
      { rotate: tilt.value + headTilt.value * HEAD_LEAN },
      { scaleX: 1 / squash.value },
      { scaleY: squash.value },
      { translateX: -x },
      { translateY: -y },
    ],
    [x, y],
  )
  const shadowOpacity = useDerivedValue(() => SHADOW.opacity * Math.max(0.3, 1 + bob.value / 200))
  const layers = useMemo<SpriteLayer[]>(() => [{ sheets: images.body }], [images])

  return (
    <>
      <Oval x={x - SHADOW.rx} y={y - SHADOW.ry} width={SHADOW.rx * 2} height={SHADOW.ry * 2} opacity={shadowOpacity}>
        <RadialGradient c={vec(x, y)} r={SHADOW.rx} colors={['#000000', 'transparent']} />
      </Oval>
      <Group transform={transform}>
        <LayeredSprite key={clipKey} manifest={manifest} layers={layers} clip={clip} playing={playing} onEnd={onClipEnd} x={x} y={y} scale={SPRITE_ELF_SCALE} flipX={flipX} />
      </Group>
    </>
  )
}
