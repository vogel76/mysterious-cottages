import { useMemo } from 'react'
import { BlurMask, Circle, Group, LinearGradient, Oval, Path, RadialGradient, Rect, RoundedRect, vec } from '@shopify/react-native-skia'
import { useDerivedValue } from 'react-native-reanimated'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { PALETTE, svgPath } from '../draw'
import type { FireMotion } from '../Fireplace'

/* A three-legged milking stool in the front right, close to the viewer,
   the default of the candle slot, with a fat beeswax candle on it: a
   dish, a candle that has run down one side, a wick and a small flame
   that leans and stretches to the candle value of the fire motion, with
   its own halo of light. The anchor is the floor under the middle of the
   seat. */

export const CANDLE_CANDLE_BOUNDS = { x: -70, y: -320, width: 140, height: 340 } as const

const SEAT_Y = -150

export function CandleCandle({ slot, fire }: { slot: Slot; fire: FireMotion }) {
  const flame = useMemo(() => svgPath('M 0 0 C -10 -8 -12 -26 0 -46 C 12 -26 10 -8 0 0 Z'), [])
  const drip = useMemo(() => svgPath('M 10 -230 C 16 -220 18 -200 14 -186 C 12 -178 18 -176 16 -168 C 14 -162 10 -164 10 -170 Z'), [])
  const legs = useMemo(() => svgPath('M -40 -136 L -56 0 L -44 0 L -30 -136 Z M 40 -136 L 56 0 L 44 0 L 30 -136 Z M -6 -136 L -4 0 L 8 0 L 6 -136 Z'), [])

  const { candle } = fire
  const flameTransform = useDerivedValue(() => [
    { translateY: -236 },
    { skewX: (candle.value - 0.5) * 0.24 },
    { scaleY: 0.82 + 0.3 * candle.value },
    { scaleX: 1.06 - 0.12 * candle.value },
  ])
  const haloOpacity = useDerivedValue(() => 0.5 + 0.5 * candle.value)

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y }]}>
      <Oval x={-70} y={-16} width={140} height={40} color={withAlpha('#000000', 0.4)}>
        <BlurMask blur={12} style="normal" />
      </Oval>

      {/* The stool. */}
      <Path path={legs}>
        <LinearGradient start={vec(-56, 0)} end={vec(56, 0)} colors={[PALETTE.beamDark, PALETTE.beam, PALETTE.beamLight]} />
      </Path>
      <Oval x={-60} y={SEAT_Y - 6} width={120} height={44} color={PALETTE.beam} />
      <Oval x={-60} y={SEAT_Y - 20} width={120} height={44}>
        <LinearGradient start={vec(-60, 0)} end={vec(60, 0)} colors={[PALETTE.beam, PALETTE.beamLight, '#a07040']} />
      </Oval>
      <Oval x={-44} y={SEAT_Y - 14} width={88} height={30} color={withAlpha('#3a2616', 0.18)} />

      {/* The dish and the candle. */}
      <Oval x={-30} y={SEAT_Y - 22} width={60} height={20} color="#5a4a3a" />
      <Oval x={-26} y={SEAT_Y - 24} width={52} height={14} color="#8a7a66" />
      <RoundedRect x={-16} y={-232} width={32} height={84} r={5}>
        <LinearGradient start={vec(-16, 0)} end={vec(16, 0)} colors={['#c9b48c', '#f1e2b8', '#d8c28e']} />
      </RoundedRect>
      <Oval x={-16} y={-238} width={32} height={12} color="#f6ead0" />
      <Path path={drip} color="#f1e2b8" />
      <Rect x={-1.5} y={-250} width={3} height={14} color="#2a1a0c" />

      {/* The flame and its halo. */}
      <Circle cx={0} cy={-250} r={70} opacity={haloOpacity}>
        <RadialGradient c={vec(0, -250)} r={70} colors={[withAlpha(PALETTE.candle, 0.55), 'transparent']} />
      </Circle>
      <Group transform={flameTransform}>
        <Path path={flame} color={withAlpha(PALETTE.fire, 0.6)}>
          <BlurMask blur={6} style="normal" />
        </Path>
        <Path path={flame}>
          <LinearGradient start={vec(0, 0)} end={vec(0, -46)} colors={[PALETTE.fireDeep, PALETTE.fire, PALETTE.fireLight]} />
        </Path>
        <Group transform={[{ scale: 0.45 }]}>
          <Path path={flame} color="#fff6d6" />
        </Group>
      </Group>
    </Group>
  )
}
