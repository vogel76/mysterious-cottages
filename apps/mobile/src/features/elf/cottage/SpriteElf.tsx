import { useMemo } from 'react'
import { ColorMatrix, Group, Oval, Paint, RadialGradient, vec } from '@shopify/react-native-skia'
import { useDerivedValue, type SharedValue } from 'react-native-reanimated'
import type { SkImage } from '@shopify/react-native-skia'
import { LayeredSprite, type SpriteImages, type SpriteLayer, type SpriteManifest } from '../sprites'
import type { PuppetMotion } from './motion'
import { ROOM, type Bounds } from './room'

/* The elf as the rendered sprite (art/blender/elf.py, packed into the
   atlases of assets/elf/sprites/<form>): the body layer with the face,
   the hair and what the form wears baked in, and the hat worn over it,
   played by the clip the scene names. The figure's feet land on the
   origin, in room units, and the cell is scaled so the figure stands its
   form's height (figureUnits: the forms share one scale, so the hatchling
   is small and the elder tall); its tap target and its shadow follow that
   height, the line above which a tap is on the head is the form's neck. The baked animation is the
   elf's own acting (the idle sway and blinks, the pat, the meal, the
   wave); over it the cottage's procedural life still plays through a
   group transform bound to the motion values: the hop (bob) lifts the
   whole figure, the lean (tilt, with a share of the head's tilt, so the
   elf still inclines towards a finger that strokes it) rotates it around
   the feet, and the squash scales it the way the puppet's body scaled.
   A soft shadow pools under the feet and thins as the elf hops. The
   frames are lit by the room's night (the fire and the moon); by day the
   figure is lifted by a colour matrix that follows the clock's daylight,
   so it does not stand in the bright room as a night picture; the same
   matrix lights the figure up for the evolution's moment (the flash).

   The frame clock restarts when the clip name changes; to play the same
   one-shot clip twice in a row the scene changes clipKey, which remounts
   the player and its clock. Nothing here is rebuilt per frame: the clock
   advances a shared value, the atlases read it. */

/* The young elf's height on screen, room units; the owner tunes this, and
   art/blender/elf.py renders the young figure at the same height in the
   plate's pixels (ROOM_FIGURE_PX) and every other form at the same scale,
   so the room's light falls on each as drawn. An atlas without its own
   figure height stands this tall. */
export const ELF_HEIGHT_UNITS = 460
/* Where the feet stand in sprite mode: the room's anchor, on the upper
   half of the rendered rug. */
export const SPRITE_ELF_ORIGIN = ROOM.elfAnchor
/* A form's height in room units. */
export function figureUnits(manifest: SpriteManifest): number {
  return manifest.figureUnits ?? ELF_HEIGHT_UNITS
}
/* Cell pixels to room units: the figure, modelHeight metres tall at the
   manifest's pixels to the metre, stands its form's height. */
function figureScale(manifest: SpriteManifest): number {
  return figureUnits(manifest) / (manifest.pixelsPerMetre * manifest.modelHeight)
}
/* How much of the head's tilt (the gaze, the stroke's lean) the whole
   figure takes, since the sprite has no separate head to turn. */
const HEAD_LEAN = 0.3
/* Above this line, measured from the feet, a tap lands on the head: the
   form's neck as rendered, or for an atlas without it a share of the
   figure's height. */
export function spriteElfHeadLine(manifest: SpriteManifest): number {
  return manifest.headUnits ?? 0.58 * figureUnits(manifest)
}

const SHADOW = { rx: 150, ry: 32, opacity: 0.3 } as const
/* How much brighter the night-lit frames are drawn in full daylight, and
   how far the evolution's flash lifts them towards light (a gain and a
   wash of warm white). */
const DAY_LIFT = 0.28
const FLASH = { gain: 0.6, wash: 0.45 } as const

/* The tap target, room units around the feet: the figure itself, not the
   atlas cell, whose transparent margins would otherwise swallow the
   basket, the bed's edge and the window's corner next to the elf. The
   figure is about 0.6 of its height wide at the ears; the box reaches a
   little under the feet and just over the hair. */
export function spriteElfHitBox(units: number): Bounds {
  return { x: -0.3 * units, y: -1.04 * units, width: 0.6 * units, height: 1.08 * units }
}

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
  /* Daylight, 0 night .. 1 full day, for the lift. */
  day: SharedValue<number>
  images: SpriteImages
  /* The hat worn, as its layer's decoded sheets; null for the bare hair. */
  hat?: { layer: string; sheets: SkImage[] } | null
  manifest: SpriteManifest
  flipX?: boolean
}

export function SpriteElf({ clip, clipKey = 0, onClipEnd, playing, motion, origin, day, images, hat = null, manifest, flipX }: SpriteElfProps) {
  const { bob, squash, tilt, headTilt, flash } = motion
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
  const daylight = useDerivedValue(() => {
    const k = 1 + DAY_LIFT * day.value + FLASH.gain * flash.value
    const w = FLASH.wash * flash.value
    return [k, 0, 0, 0, w, 0, k, 0, 0, w * 0.92, 0, 0, k, 0, w * 0.7, 0, 0, 0, 1, 0]
  })
  const layers = useMemo<SpriteLayer[]>(() => (hat ? [{ sheets: images.body }, { layer: hat.layer, sheets: hat.sheets }] : [{ sheets: images.body }]), [images, hat])
  const scale = useMemo(() => figureScale(manifest), [manifest])
  /* The shadow is the young elf's at its height, sized with the form. */
  const shadow = useMemo(() => {
    const k = figureUnits(manifest) / ELF_HEIGHT_UNITS
    return { rx: SHADOW.rx * k, ry: SHADOW.ry * Math.sqrt(k) }
  }, [manifest])

  return (
    <>
      <Oval x={x - shadow.rx} y={y - shadow.ry} width={shadow.rx * 2} height={shadow.ry * 2} opacity={shadowOpacity}>
        <RadialGradient c={vec(x, y)} r={shadow.rx} colors={['#000000', 'transparent']} />
      </Oval>
      <Group
        transform={transform}
        layer={
          <Paint>
            <ColorMatrix matrix={daylight} />
          </Paint>
        }
      >
        <LayeredSprite key={clipKey} manifest={manifest} layers={layers} clip={clip} playing={playing} onEnd={onClipEnd} x={x} y={y} scale={scale} flipX={flipX} />
      </Group>
    </>
  )
}
