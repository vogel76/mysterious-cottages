import { useMemo } from 'react'
import { Circle, DashPathEffect, Group, Line, LinearGradient, Path, RadialGradient, Rect, RoundedRect, vec } from '@shopify/react-native-skia'
import { useDerivedValue } from 'react-native-reanimated'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { PALETTE, svgPath } from '../draw'
import type { FireMotion } from '../Fireplace'

/* The default of the lantern slot: an iron lantern hanging from the top
   beam on a chain in the upper right, its glass panes lit amber from the
   small flame inside; the light leaks onto the beam and the wall around
   it and breathes with the candle value of the fire motion; the chain and
   the body hang on its swing value and pivot at the chain's top when a
   tap on the slot kicks it. The anchor is the bottom of the lantern; the
   chain starts 280 units above it. */

/* The swing value is -1..1; this is the full lean in radians. */
const SWING_RAD = 0.12

/* The chain's top to the lantern's base, the base plate at the sides; the halo is light, not body. */
export const LANTERN_IRON_BOUNDS = { x: -38, y: -280, width: 76, height: 280 }

export function LanternIron({ slot, fire }: { slot: Slot; fire: FireMotion }) {
  const cap = useMemo(() => svgPath('M -34 -112 L -18 -140 L 18 -140 L 34 -112 Z'), [])
  const flame = useMemo(() => svgPath('M 0 0 C -7 -6 -8 -18 0 -30 C 8 -18 7 -6 0 0 Z'), [])

  const { candle, swing } = fire
  const glowOpacity = useDerivedValue(() => 0.6 + 0.4 * candle.value)
  const flameTransform = useDerivedValue(() => [{ translateY: -36 }, { scaleY: 0.86 + 0.24 * candle.value }, { skewX: (candle.value - 0.5) * 0.16 }])
  const swingTransform = useDerivedValue(() => [{ rotate: swing.value * SWING_RAD }])

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y }]}>
      <Circle cx={0} cy={-62} r={120} opacity={glowOpacity}>
        <RadialGradient c={vec(0, -62)} r={120} colors={[withAlpha(PALETTE.candle, 0.4), 'transparent']} />
      </Circle>

      {/* Everything that hangs swings around the chain's top. */}
      <Group transform={swingTransform} origin={vec(0, -280)}>
        {/* The chain and the ring. */}
        <Line p1={vec(0, -280)} p2={vec(0, -150)} strokeWidth={6} strokeCap="round" color="#2a2a2e">
          <DashPathEffect intervals={[10, 7]} />
        </Line>
        <Circle cx={0} cy={-148} r={9} style="stroke" strokeWidth={4} color="#2a2a2e" />
        <Path path={cap}>
          <LinearGradient start={vec(-34, 0)} end={vec(34, 0)} colors={['#1e1e22', '#3a3a40', '#1e1e22']} />
        </Path>

        {/* The glass and the frame around it. */}
        <Rect x={-28} y={-112} width={56} height={98}>
          <LinearGradient start={vec(0, -112)} end={vec(0, -14)} colors={[withAlpha(PALETTE.candle, 0.95), withAlpha(PALETTE.fire, 0.9), withAlpha(PALETTE.fireDeep, 0.8)]} />
        </Rect>
        <Group transform={flameTransform}>
          <Path path={flame} color={PALETTE.fireLight} />
          <Group transform={[{ scale: 0.5 }]}>
            <Path path={flame} color="#fff6d6" />
          </Group>
      </Group>
      <Rect x={-4} y={-32} width={8} height={18} color="#3a2a1a" />
      <Rect x={-28} y={-112} width={56} height={98} color={withAlpha('#ffffff', 0.08)} />
      <RoundedRect x={-34} y={-116} width={68} height={104} r={4} style="stroke" strokeWidth={8} color="#26262a" />
      <Rect x={-2} y={-112} width={4} height={98} color="#26262a" />
      <Rect x={-28} y={-64} width={56} height={4} color="#26262a" />
      <RoundedRect x={-38} y={-16} width={76} height={16} r={4}>
        <LinearGradient start={vec(0, -16)} end={vec(0, 0)} colors={['#3a3a40', '#16161a']} />
      </RoundedRect>
      <Circle cx={-26} cy={-118} r={3} color="#55555c" />
      <Circle cx={26} cy={-118} r={3} color="#55555c" />
      </Group>
    </Group>
  )
}
