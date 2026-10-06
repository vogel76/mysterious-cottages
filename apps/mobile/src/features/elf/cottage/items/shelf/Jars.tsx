import { useMemo } from 'react'
import { Circle, Group, LinearGradient, Path, Rect, RoundedRect, vec } from '@shopify/react-native-skia'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { PALETTE, svgPath } from '../draw'
import type { FireMotion } from '../Fireplace'

/* The pantry shelf: the same oak plank on two brackets, with a jar of
   honey under a wooden lid, a jar of forest jam with a cloth tied over
   it, both labelled, and a stone mortar with its pestle leaning in it.
   The anchor is the middle of the plank's underside. */

const CLOTH = 'M -26 -78 Q -22 -92 0 -94 Q 22 -92 26 -78 L 26 -70 Q 0 -64 -26 -70 Z'
const GLASS = 'M -70 -70 h 5 v 46 h -5 Z M -16 -74 h 5 v 52 h -5 Z'
const BOWL = 'M 36 -50 L 86 -50 Q 86 -16 61 -16 Q 36 -16 36 -50 Z'

/* The pestle's knob to the brackets' tips, the plank's shadow at the sides. */
export const SHELF_JARS_BOUNDS = { x: -86, y: -100, width: 174, height: 130 }

export function ShelfJars({ slot }: { slot: Slot; fire: FireMotion }) {
  const brackets = useMemo(() => svgPath('M -70 0 L -58 0 L -58 26 Z M 70 0 L 58 0 L 58 26 Z'), [])
  const cloth = useMemo(() => svgPath(CLOTH), [])
  const glass = useMemo(() => svgPath(GLASS), [])
  const bowl = useMemo(() => svgPath(BOWL), [])

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y }]}>
      <Rect x={-86} y={0} width={172} height={30}>
        <LinearGradient start={vec(0, 0)} end={vec(0, 30)} colors={[withAlpha('#000000', 0.38), 'transparent']} />
      </Rect>

      {/* The honey jar with a wooden lid. */}
      <RoundedRect x={-74} y={-76} width={40} height={60} r={6}>
        <LinearGradient start={vec(0, -76)} end={vec(0, -16)} colors={['#f0b640', '#c67a1a']} />
      </RoundedRect>
      <RoundedRect x={-76} y={-84} width={44} height={12} r={3} color="#8a6238" />
      <Rect x={-70} y={-50} width={32} height={14} color={withAlpha(PALETTE.cream, 0.9)} />

      {/* The jam jar with a cloth tied over it. */}
      <RoundedRect x={-22} y={-80} width={44} height={64} r={6}>
        <LinearGradient start={vec(0, -80)} end={vec(0, -16)} colors={['#9a2a3a', '#5a1420']} />
      </RoundedRect>
      <Path path={cloth} color="#dfe8d8" />
      <Rect x={-26} y={-76} width={52} height={3} color={PALETTE.accent} />
      <Rect x={-16} y={-52} width={32} height={16} color={withAlpha(PALETTE.cream, 0.9)} />
      <Path path={glass} color={withAlpha('#ffffff', 0.25)} />

      {/* The mortar and the pestle leaning in it. */}
      <Group transform={[{ translateX: 58 }, { translateY: -46 }, { rotate: -0.35 }]}>
        <RoundedRect x={-4} y={-44} width={8} height={44} r={4} color="#8a6238" />
        <Circle cx={0} cy={-44} r={6} color={PALETTE.beamLight} />
      </Group>
      <Path path={bowl}>
        <LinearGradient start={vec(36, 0)} end={vec(86, 0)} colors={[PALETTE.stoneDark, PALETTE.stoneLight, PALETTE.stone]} />
      </Path>
      <RoundedRect x={32} y={-54} width={58} height={8} r={3} color={PALETTE.stoneLight} />

      {/* The plank and its brackets. */}
      <RoundedRect x={-84} y={-16} width={168} height={16} r={3}>
        <LinearGradient start={vec(0, -16)} end={vec(0, 0)} colors={[PALETTE.beamLight, PALETTE.beam]} />
      </RoundedRect>
      <Rect x={-84} y={-16} width={168} height={3} color={withAlpha('#a87a4a', 0.6)} />
      <Path path={brackets} color={PALETTE.beamDark} />
    </Group>
  )
}
