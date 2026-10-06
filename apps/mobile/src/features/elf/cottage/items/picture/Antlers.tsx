import { useMemo } from 'react'
import { Circle, Group, Line, LinearGradient, Oval, Path, vec } from '@shopify/react-native-skia'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { PALETTE, svgPath } from '../draw'
import type { FireMotion } from '../Fireplace'

/* A small pair of roe antlers on a shield-shaped oak plaque, screwed to
   the wall at the corners and hung from a nail on a cord, a hunting-lodge
   touch for the wall above the mantel. The antlers are one stroked path,
   drawn twice: once darker and offset for depth, once in bone. The anchor
   is the middle of the plaque's bottom edge. */

const PLAQUE = 'M -50 -96 L 50 -96 L 50 -40 Q 50 -4 0 0 Q -50 -4 -50 -40 Z'
const ANTLERS =
  'M -6 -52 C -20 -58 -30 -76 -30 -96 M -24 -70 C -32 -72 -40 -70 -46 -62 M -28 -84 C -34 -86 -40 -84 -44 -78 M -29 -94 L -24 -110 ' +
  'M 6 -52 C 20 -58 30 -76 30 -96 M 24 -70 C 32 -72 40 -70 46 -62 M 28 -84 C 34 -86 40 -84 44 -78 M 29 -94 L 24 -110'
const SCREWS = [-42, 42].map((x) => `M ${x - 3} -88 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0 Z M ${x - 3} -38 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0 Z`).join(' ')

/* The nail at the top, the antler tips above the plaque, the plaque's drop shadow. */
export const PICTURE_ANTLERS_BOUNDS = { x: -52, y: -133, width: 107, height: 137 }

export function PictureAntlers({ slot }: { slot: Slot; fire: FireMotion }) {
  const plaque = useMemo(() => svgPath(PLAQUE), [])
  const antlers = useMemo(() => svgPath(ANTLERS), [])
  const screws = useMemo(() => svgPath(SCREWS), [])

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y }]}>
      <Line p1={vec(-40, -96)} p2={vec(0, -128)} strokeWidth={2} color="#2a2a2e" />
      <Line p1={vec(40, -96)} p2={vec(0, -128)} strokeWidth={2} color="#2a2a2e" />
      <Circle cx={0} cy={-129} r={4} color="#55555c" />

      {/* The plaque with its shadow and bevel. */}
      <Path path={plaque} color={withAlpha('#000000', 0.3)} transform={[{ translateX: 3 }, { translateY: 4 }]} />
      <Path path={plaque}>
        <LinearGradient start={vec(-50, -96)} end={vec(50, 0)} colors={[PALETTE.plankLight, PALETTE.plank, PALETTE.beamDark]} />
      </Path>
      <Path path={plaque} style="stroke" strokeWidth={3} color={withAlpha(PALETTE.beamDark, 0.7)} />
      <Path path={screws} color="#2a2a2e" />

      {/* The antlers over a small skull plate. */}
      <Path path={antlers} style="stroke" strokeWidth={7} strokeCap="round" strokeJoin="round" color="#b9ad92" transform={[{ translateX: 2 }, { translateY: 3 }]} />
      <Path path={antlers} style="stroke" strokeWidth={7} strokeCap="round" strokeJoin="round" color="#e6dcc4" />
      <Oval x={-14} y={-60} width={28} height={20} color="#efe6d2" />
      <Oval x={-10} y={-57} width={20} height={6} color={withAlpha('#b9ad92', 0.6)} />
    </Group>
  )
}
