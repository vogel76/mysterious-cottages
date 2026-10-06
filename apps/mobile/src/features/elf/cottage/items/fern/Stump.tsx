import { useMemo } from 'react'
import { BlurMask, Circle, Group, LinearGradient, Oval, Path, RadialGradient, RoundedRect, vec } from '@shopify/react-native-skia'
import { useDerivedValue } from 'react-native-reanimated'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { PALETTE, buildPath, svgPath } from '../draw'
import type { FireMotion } from '../Fireplace'

/* A tree stump in the front left corner, in place of the fern: a squat
   trunk with rough bark and root flares, its sawn top showing growth
   rings, a snail with a spiral shell crossing the top and a tiny iron
   lantern set on it whose flame and halo flicker to the candle value of
   the fire motion, the same tempo as the candle on the stool. The anchor
   is the floor under the middle of the stump. */

export const FERN_STUMP_BOUNDS = { x: -90, y: -240, width: 180, height: 262 } as const

const TOP_Y = -120
const LANTERN = { x: 22, y: TOP_Y - 14 }

export function FernStump({ slot, fire }: { slot: Slot; fire: FireMotion }) {
  const trunk = useMemo(() => svgPath('M -56 -118 C -58 -60 -60 -30 -72 0 L 72 0 C 60 -30 58 -60 56 -118 Z'), [])
  const bark = useMemo(() => svgPath('M -38 -100 C -42 -70 -36 -50 -44 -14 M -8 -104 C -4 -70 -12 -40 -6 -10 M 30 -100 C 34 -72 26 -46 36 -12'), [])
  const rings = useMemo(
    () =>
      buildPath((path) => {
        for (const r of [0.75, 0.52, 0.3]) path.addOval({ x: -50 * r, y: TOP_Y - 18 * r, width: 100 * r, height: 36 * r })
      }),
    [],
  )
  const shell = useMemo(() => svgPath('M -26 -134 C -26 -156 2 -156 2 -138 C 2 -126 -14 -126 -14 -136 C -14 -142 -6 -142 -6 -137'), [])
  const snail = useMemo(() => svgPath('M -34 -126 C -30 -132 -8 -134 10 -128 C 16 -126 16 -124 10 -124 L -30 -124 C -36 -124 -36 -126 -34 -126 Z'), [])
  const feelers = useMemo(() => svgPath('M -30 -128 L -36 -140 M -26 -128 L -24 -141'), [])
  const flame = useMemo(() => svgPath('M 0 0 C -5 -4 -6 -13 0 -22 C 6 -13 5 -4 0 0 Z'), [])

  const { candle } = fire
  const flameTransform = useDerivedValue(() => [
    { translateX: LANTERN.x },
    { translateY: LANTERN.y - 10 },
    { scaleY: 0.85 + 0.3 * candle.value },
    { scaleX: 1.05 - 0.1 * candle.value },
  ])
  const haloOpacity = useDerivedValue(() => 0.45 + 0.55 * candle.value)

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y }]}>
      <Oval x={-80} y={-14} width={160} height={36} color={withAlpha('#000000', 0.42)}>
        <BlurMask blur={12} style="normal" />
      </Oval>

      {/* The trunk and its sawn top. */}
      <Path path={trunk}>
        <LinearGradient start={vec(-70, 0)} end={vec(70, 0)} colors={[PALETTE.beamDark, PALETTE.beamLight, PALETTE.beam]} positions={[0, 0.45, 1]} />
      </Path>
      <Path path={bark} style="stroke" strokeWidth={4} strokeCap="round" color={withAlpha('#2a1a0c', 0.45)} />
      <Oval x={-56} y={TOP_Y - 20} width={112} height={40} color="#4a3019" />
      <Oval x={-52} y={TOP_Y - 18} width={104} height={36}>
        <LinearGradient start={vec(-52, 0)} end={vec(52, 0)} colors={['#c9a86e', '#e2c89a', '#c9a86e']} />
      </Oval>
      <Path path={rings} style="stroke" strokeWidth={2} color={withAlpha('#8a6238', 0.55)} />

      {/* The snail crossing the top. */}
      <Path path={snail} color="#b8a07a" />
      <Path path={feelers} style="stroke" strokeWidth={2} strokeCap="round" color="#8a7a5a" />
      <Path path={shell} style="stroke" strokeWidth={6} strokeCap="round" color="#8a5a3a" />

      {/* The tiny lantern: a frame, a glass that glows, a ring on top. */}
      <Circle cx={LANTERN.x} cy={LANTERN.y - 20} r={54} opacity={haloOpacity}>
        <RadialGradient c={vec(LANTERN.x, LANTERN.y - 20)} r={54} colors={[withAlpha(PALETTE.candle, 0.5), 'transparent']} />
      </Circle>
      <RoundedRect x={LANTERN.x - 16} y={LANTERN.y - 42} width={32} height={42} r={5} color={withAlpha(PALETTE.candle, 0.55)} />
      <RoundedRect x={LANTERN.x - 16} y={LANTERN.y - 42} width={32} height={42} r={5} style="stroke" strokeWidth={4} color="#3b3b3f" />
      <RoundedRect x={LANTERN.x - 20} y={LANTERN.y - 50} width={40} height={10} r={3} color="#3b3b3f" />
      <Circle cx={LANTERN.x} cy={LANTERN.y - 56} r={6} style="stroke" strokeWidth={3} color="#3b3b3f" />
      <Group transform={flameTransform}>
        <Path path={flame}>
          <LinearGradient start={vec(0, 0)} end={vec(0, -22)} colors={[PALETTE.fireDeep, PALETTE.fire, PALETTE.fireLight]} />
        </Path>
      </Group>
    </Group>
  )
}
