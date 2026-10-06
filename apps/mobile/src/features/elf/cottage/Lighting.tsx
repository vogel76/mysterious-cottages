import { useEffect, useMemo } from 'react'
import { Group, LinearGradient, Path, Rect, RadialGradient, vec } from '@shopify/react-native-skia'
import { useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated'
import { EASING, colors, withAlpha } from '../../../ui'
import type { FireMotion } from './items/Fireplace'
import { ROOM } from './room'
import { svgPath } from './items/draw'

/* The light in the room, painted over everything else: the fire's warm
   glow reaching across the wall and pooling on the floor before the
   hearth (one radial gradient with a bright core at the hearth and a wide
   fall-off, so the wall and the floor are lit by a single node), the
   small halos of the candle and the lantern, and the light from the
   window: by night the moon on the wall and as a slanted beam across the
   floor, by day a warmer sun beam in the same place while a cream wash
   with screen blend lifts the whole room. The glows are gradients blended
   with screen, so they brighten what is under them the way light does
   instead of covering it with paint, and each breathes with the fire
   motion it belongs to.

   The time of day comes in through the fire motion's day value (0 night,
   1 full day), fed by the cottage clock: daylight fades the fire's glow
   and the lantern's halo, since a hearth matters less at noon, puts out
   the moon and brings up the sun beam and the wash. Sleep settles the
   room: a navy tint of the app's page colour falls over everything, the
   fire's glow drops to less than half, and the moonlight grows, so the
   night outside takes over from the hearth; the clock already holds day
   at 0 while the elf sleeps. The change is a single value eased over 800
   ms by the sleeping prop; with reduce motion on it switches at once.
   The washes over the whole room reach down by the room's overrun, so a
   room lifted behind an open panel is tinted to its visible edge. Eight
   drawing nodes in all, none rebuilt per frame.

   The rendered room (RoomSprites) already carries its light: the plate
   is lit in Blender, fire and all. Over it the scene uses PlateLighting
   instead, which keeps only what the plate cannot do by itself: the pulse
   of the fire's glow over the hearth, breathing with the flicker, and the
   navy tint of sleep. Two nodes. */

const FULL_HEIGHT = ROOM.height + ROOM.overrun

const NIGHT_MS = 800
const NIGHT_TINT = 0.45
/* How much the cream wash lifts the room in full daylight. */
const DAY_WASH = 0.16

/* The beam of light from the window's opening down onto the floor: the
   moon low and long, the sun higher and steeper. */
const MOON_BEAM = 'M 200 790 L 440 790 L 620 1500 L 10 1500 Z'
const SUN_BEAM = 'M 200 790 L 440 790 L 760 1500 L 180 1500 Z'

export type LightingProps = {
  sleeping: boolean
  fire: FireMotion
  reduceMotion: boolean
}

export function Lighting({ sleeping, fire, reduceMotion }: LightingProps) {
  const night = useSharedValue(sleeping ? 1 : 0)
  useEffect(() => {
    night.value = withTiming(sleeping ? 1 : 0, { duration: reduceMotion ? 0 : NIGHT_MS, easing: EASING.inOut })
  }, [sleeping, reduceMotion, night])

  const moonBeam = useMemo(() => svgPath(MOON_BEAM), [])
  const sunBeam = useMemo(() => svgPath(SUN_BEAM), [])

  const { flicker, candle, day } = fire
  /* Daylight never shines into a sleeping room, whatever the clock says. */
  const light = useDerivedValue(() => day.value * (1 - night.value))
  const fireGlow = useDerivedValue(() => (0.62 + 0.3 * flicker.value) * (1 - 0.6 * night.value) * (1 - 0.55 * light.value))
  const candleGlow = useDerivedValue(() => (0.55 + 0.35 * candle.value) * (1 - 0.3 * night.value) * (1 - 0.5 * light.value))
  const lanternGlow = useDerivedValue(() => (0.6 + 0.25 * candle.value) * (1 - 0.3 * night.value) * (1 - 0.6 * light.value))
  const tint = useDerivedValue(() => NIGHT_TINT * night.value)
  const moonWall = useDerivedValue(() => (0.6 + 0.8 * night.value) * (1 - light.value))
  const moonFloor = useDerivedValue(() => (0.7 + 0.8 * night.value) * (1 - light.value))
  const wash = useDerivedValue(() => DAY_WASH * light.value)
  const sun = useDerivedValue(() => 0.85 * light.value)

  return (
    <Group>
      {/* The fire on the wall and the floor: a bright pool at the hearth
          inside a wide glow. */}
      <Rect x={0} y={0} width={ROOM.width} height={FULL_HEIGHT} opacity={fireGlow} blendMode="screen">
        <RadialGradient c={vec(740, 1130)} r={780} colors={[withAlpha('#ffb347', 0.62), withAlpha('#ffb347', 0.34), withAlpha('#ff7a1a', 0.14), 'transparent']} positions={[0, 0.2, 0.5, 1]} />
      </Rect>

      {/* The candle and the lantern. */}
      <Rect x={540} y={940} width={520} height={520} opacity={candleGlow} blendMode="screen">
        <RadialGradient c={vec(800, 1190)} r={260} colors={[withAlpha('#ffd98a', 0.42), 'transparent']} />
      </Rect>
      <Rect x={610} y={140} width={400} height={400} opacity={lanternGlow} blendMode="screen">
        <RadialGradient c={vec(810, 340)} r={200} colors={[withAlpha('#ffd98a', 0.34), 'transparent']} />
      </Rect>

      {/* Daylight: the cream wash over the room and the sun through the window. */}
      <Rect x={0} y={0} width={ROOM.width} height={FULL_HEIGHT} color="#ffe6bf" opacity={wash} blendMode="screen" />
      <Path path={sunBeam} opacity={sun} blendMode="screen">
        <LinearGradient start={vec(320, 790)} end={vec(420, 1500)} colors={[withAlpha('#fff1c8', 0.42), withAlpha('#ffe0a0', 0.18), 'transparent']} positions={[0, 0.5, 1]} />
      </Path>

      {/* Sleep: the navy tint. */}
      <Rect x={0} y={0} width={ROOM.width} height={FULL_HEIGHT} color={colors.page} opacity={tint} />

      {/* The moon through the window, on the wall and across the floor. */}
      <Rect x={0} y={200} width={740} height={760} opacity={moonWall} blendMode="screen">
        <RadialGradient c={vec(320, 580)} r={400} colors={[withAlpha('#9fc4ff', 0.3), withAlpha('#9fc4ff', 0.08), 'transparent']} positions={[0, 0.5, 1]} />
      </Rect>
      <Path path={moonBeam} opacity={moonFloor} blendMode="screen">
        <LinearGradient start={vec(320, 790)} end={vec(320, 1500)} colors={[withAlpha('#9fc4ff', 0.3), withAlpha('#9fc4ff', 0.14), 'transparent']} positions={[0, 0.5, 1]} />
      </Path>
    </Group>
  )
}

/* The glow over the plate's hearth: its centre and reach in room units
   and how strong it gets at the flicker's peak. The owner tunes this. */
export const HEARTH_GLOW = { cx: 735, cy: 1060, r: 480, strength: 0.32 } as const

export function PlateLighting({ sleeping, fire, reduceMotion }: LightingProps) {
  const night = useSharedValue(sleeping ? 1 : 0)
  useEffect(() => {
    night.value = withTiming(sleeping ? 1 : 0, { duration: reduceMotion ? 0 : NIGHT_MS, easing: EASING.inOut })
  }, [sleeping, reduceMotion, night])

  const { flicker } = fire
  const glow = useDerivedValue(() => HEARTH_GLOW.strength * (0.45 + 0.55 * flicker.value) * (1 - 0.6 * night.value))
  const tint = useDerivedValue(() => NIGHT_TINT * night.value)

  return (
    <Group>
      <Rect x={HEARTH_GLOW.cx - HEARTH_GLOW.r} y={HEARTH_GLOW.cy - HEARTH_GLOW.r} width={HEARTH_GLOW.r * 2} height={HEARTH_GLOW.r * 2} opacity={glow} blendMode="screen">
        <RadialGradient c={vec(HEARTH_GLOW.cx, HEARTH_GLOW.cy)} r={HEARTH_GLOW.r} colors={[withAlpha('#ffb347', 0.7), withAlpha('#ff7a1a', 0.22), 'transparent']} positions={[0, 0.45, 1]} />
      </Rect>
      <Rect x={0} y={0} width={ROOM.width} height={FULL_HEIGHT} color={colors.page} opacity={tint} />
    </Group>
  )
}
