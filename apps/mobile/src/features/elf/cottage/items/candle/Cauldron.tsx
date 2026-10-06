import { useMemo } from 'react'
import { BlurMask, Circle, Group, LinearGradient, Oval, Path, RadialGradient, vec } from '@shopify/react-native-skia'
import { useDerivedValue } from 'react-native-reanimated'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { PALETTE, svgPath } from '../draw'
import type { FireMotion } from '../Fireplace'

/* A small iron cauldron on a three-legged stand in the front right, in
   place of the candle stool: a bulging black pot with a rolled rim and a
   bent handle, a few embers under it, and a green brew whose glow pulses
   to the candle value of the fire motion while one bubble keeps rising
   from the surface and fading out. The anchor is the floor under the
   middle of the stand. */

export const CANDLE_CAULDRON_BOUNDS = { x: -90, y: -300, width: 180, height: 320 } as const

const BREW_Y = -168

export function CandleCauldron({ slot, fire }: { slot: Slot; fire: FireMotion }) {
  const legs = useMemo(() => svgPath('M -44 -60 L -62 0 L -50 0 L -34 -60 Z M 44 -60 L 62 0 L 50 0 L 34 -60 Z M -5 -60 L -3 0 L 7 0 L 5 -60 Z'), [])
  const pot = useMemo(() => svgPath('M -62 -160 C -70 -120 -60 -70 -30 -56 L 30 -56 C 60 -70 70 -120 62 -160 Z'), [])
  const handle = useMemo(() => svgPath('M -58 -176 C -50 -236 50 -236 58 -176'), [])
  const embers = useMemo(() => svgPath('M -30 -58 C -22 -74 -8 -70 -4 -60 C 2 -76 16 -74 22 -58 Z'), [])

  const { candle } = fire
  const glowOpacity = useDerivedValue(() => 0.55 + 0.45 * candle.value)
  const bubbleTransform = useDerivedValue(() => [{ translateX: 14 }, { translateY: BREW_Y - 6 - 36 * candle.value }])
  const bubbleOpacity = useDerivedValue(() => 0.9 - 0.8 * candle.value)
  const bubbleRadius = useDerivedValue(() => 5 + 6 * candle.value)

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y }]}>
      <Oval x={-76} y={-16} width={152} height={40} color={withAlpha('#000000', 0.4)}>
        <BlurMask blur={12} style="normal" />
      </Oval>

      {/* The stand, the embers and the handle behind the pot. */}
      <Path path={legs}>
        <LinearGradient start={vec(-62, 0)} end={vec(62, 0)} colors={['#2a2a2e', '#4a4a50', '#2a2a2e']} />
      </Path>
      <Path path={embers}>
        <LinearGradient start={vec(0, -76)} end={vec(0, -56)} colors={[PALETTE.fire, PALETTE.fireDeep]} />
      </Path>
      <Path path={handle} style="stroke" strokeWidth={7} strokeCap="round" color="#3b3b3f" />

      {/* The pot and its rim. */}
      <Path path={pot}>
        <LinearGradient start={vec(-62, 0)} end={vec(62, 0)} colors={['#1e1e22', '#4a4a50', '#2a2a2e']} positions={[0, 0.4, 1]} />
      </Path>
      <Oval x={-68} y={-178} width={136} height={30} color="#3b3b3f" />
      <Oval x={-68} y={-180} width={136} height={14} color={withAlpha('#9a9aa0', 0.35)} />

      {/* The brew, its glow and the bubble. */}
      <Oval x={-58} y={BREW_Y - 10} width={116} height={22}>
        <RadialGradient c={vec(0, BREW_Y)} r={60} colors={['#b8f07a', '#5aa83c', '#2f6a28']} positions={[0, 0.55, 1]} />
      </Oval>
      <Circle cx={0} cy={BREW_Y - 20} r={110} opacity={glowOpacity}>
        <RadialGradient c={vec(0, BREW_Y - 20)} r={110} colors={[withAlpha('#9ae86a', 0.5), 'transparent']} />
      </Circle>
      <Group transform={bubbleTransform} opacity={bubbleOpacity}>
        <Circle cx={0} cy={0} r={bubbleRadius} style="stroke" strokeWidth={2} color="#d8ffb0" />
      </Group>
    </Group>
  )
}
