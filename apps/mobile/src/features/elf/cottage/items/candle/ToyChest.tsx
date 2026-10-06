import { useMemo } from 'react'
import { BlurMask, Circle, Group, LinearGradient, Oval, Path, RadialGradient, Rect, RoundedRect, vec } from '@shopify/react-native-skia'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { PALETTE, svgPath } from '../draw'
import type { FireMotion } from '../Fireplace'

/* A wooden toy chest in the front right, in place of the candle stool: a
   plank box with two iron bands and a clasp, its lid propped ajar and
   leaning back so the dark inside shows, and a striped ball peeking out
   over the front edge. The anchor is the floor under the middle of the
   chest. */

export const CANDLE_TOYCHEST_BOUNDS = { x: -120, y: -200, width: 240, height: 220 } as const

export function CandleToyChest({ slot }: { slot: Slot; fire: FireMotion }) {
  const lid = useMemo(() => svgPath('M -108 -126 L 108 -126 L 92 -188 L -92 -188 Z'), [])
  const lidInside = useMemo(() => svgPath('M -96 -132 L 96 -132 L 84 -180 L -84 -180 Z'), [])
  const planks = useMemo(() => svgPath('M -104 -94 L 104 -94 M -104 -62 L 104 -62 M -104 -30 L 104 -30'), [])
  const ballStripe = useMemo(() => svgPath('M 20 -148 C 36 -144 48 -134 52 -118 M 20 -148 C 4 -144 -8 -134 -12 -118'), [])

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y }]}>
      <Oval x={-116} y={-16} width={232} height={40} color={withAlpha('#000000', 0.4)}>
        <BlurMask blur={12} style="normal" />
      </Oval>

      {/* The lid, leaning back, and the inside of the box. */}
      <Path path={lid}>
        <LinearGradient start={vec(0, -188)} end={vec(0, -126)} colors={[PALETTE.beamLight, PALETTE.beam]} />
      </Path>
      <Path path={lidInside} color={withAlpha('#2a1a0c', 0.55)} />
      <Rect x={-104} y={-130} width={208} height={14} color="#1a120c" />

      {/* The ball peeking out over the front edge. */}
      <Circle cx={20} cy={-118} r={32}>
        <RadialGradient c={vec(10, -130)} r={38} colors={['#f0a6b4', '#c9445a']} />
      </Circle>
      <Path path={ballStripe} style="stroke" strokeWidth={6} strokeCap="round" color={PALETTE.cream} />

      {/* The box: planks, iron bands and the clasp. */}
      <RoundedRect x={-110} y={-120} width={220} height={120} r={8}>
        <LinearGradient start={vec(-110, 0)} end={vec(110, 0)} colors={[PALETTE.beam, PALETTE.beamLight, PALETTE.beam]} />
      </RoundedRect>
      <Path path={planks} style="stroke" strokeWidth={3} color={withAlpha('#2a1a0c', 0.4)} />
      <Rect x={-110} y={-120} width={220} height={6} color={withAlpha('#a87a4a', 0.6)} />
      <Rect x={-72} y={-120} width={14} height={120} color="#3b3b3f" />
      <Rect x={58} y={-120} width={14} height={120} color="#3b3b3f" />
      <RoundedRect x={-12} y={-122} width={24} height={30} r={5} color="#3b3b3f" />
      <Circle cx={0} cy={-102} r={4} color={withAlpha('#9a9aa0', 0.6)} />
      <Rect x={-100} y={-6} width={20} height={6} color={PALETTE.beamDark} />
      <Rect x={80} y={-6} width={20} height={6} color={PALETTE.beamDark} />
    </Group>
  )
}
