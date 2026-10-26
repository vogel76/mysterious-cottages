import { useEffect } from 'react'
import { Group, RadialGradient, Rect, vec } from '@shopify/react-native-skia'
import { useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated'
import { EASING, colors, withAlpha } from '../../../ui'
import type { FireMotion } from './fire'
import { ROOM } from './room'

/* The light painted over the rendered room. The plate is lit in Blender,
   fire and all, so only what the picture cannot do by itself is drawn
   here, in two nodes: the pulse of the fire's glow over the hearth,
   breathing with the flicker, and the navy tint of sleep, the app's page
   colour falling over everything, eased over 800 ms by the sleeping prop
   (with reduce motion on it switches at once). The tint reaches down by
   the room's overrun, so a room lifted behind an open panel is tinted to
   its visible edge. The hour's light (the window's sky, a sun beam) comes
   back once the pipeline renders a day and a night plate. */

const FULL_HEIGHT = ROOM.height + ROOM.overrun

const NIGHT_MS = 800
const NIGHT_TINT = 0.45

/* The glow over the plate's hearth: its centre and reach in room units
   and how strong it gets at the flicker's peak. The owner tunes this. */
export const HEARTH_GLOW = { cx: 735, cy: 1060, r: 480, strength: 0.32 } as const

export type LightingProps = {
  sleeping: boolean
  fire: FireMotion
  reduceMotion: boolean
}

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
