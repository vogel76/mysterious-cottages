import { useMemo } from 'react'
import { Circle, Group, LinearGradient, Path, Rect, RoundedRect, vec } from '@shopify/react-native-skia'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { PALETTE, svgPath } from '../draw'
import type { FireMotion } from '../Fireplace'

/* The nursery shelf: the same oak plank on two brackets, with three clay
   pots of seedlings at different heights and a green tin watering can at
   the end. The pots, rims, soil, stems and leaves are one path each, so
   the whole shelf stays small. The anchor is the middle of the plank's
   underside. */

const POTS: ReadonlyArray<{ x: number; height: number }> = [
  { x: -62, height: 22 },
  { x: -22, height: 32 },
  { x: 18, height: 16 },
]
const POT_BODIES = POTS.map(({ x }) => `M ${x - 18} -52 L ${x + 18} -52 L ${x + 14} -16 L ${x - 14} -16 Z`).join(' ')
const POT_RIMS = POTS.map(({ x }) => `M ${x - 20} -56 h 40 v 8 h -40 Z`).join(' ')
const SOIL = POTS.map(({ x }) => `M ${x - 16} -52 h 32 v 4 h -32 Z`).join(' ')
const STEMS = POTS.map(({ x, height }) => `M ${x} -52 L ${x} ${-52 - height} M ${x} ${-52 - height * 0.5} L ${x - 5} ${-56 - height * 0.5}`).join(' ')
const LEAVES = POTS.map(({ x, height }) => {
  const top = -52 - height
  return `M ${x} ${top} q -12 -2 -14 -12 q 12 0 14 12 Z M ${x} ${top} q 12 -2 14 -12 q -12 0 -14 12 Z M ${x - 5} ${-56 - height * 0.5} q -8 -1 -9 -8 q 8 0 9 8 Z`
}).join(' ')
const SPOUT = 'M 48 -44 L 30 -70 L 36 -74 L 52 -52 Z'
const HANDLE = 'M 58 -56 Q 64 -80 82 -58'

/* The tallest seedling to the brackets' tips, the plank's shadow at the sides. */
export const SHELF_SEEDLINGS_BOUNDS = { x: -86, y: -98, width: 174, height: 128 }

export function ShelfSeedlings({ slot }: { slot: Slot; fire: FireMotion }) {
  const brackets = useMemo(() => svgPath('M -70 0 L -58 0 L -58 26 Z M 70 0 L 58 0 L 58 26 Z'), [])
  const pots = useMemo(() => svgPath(POT_BODIES), [])
  const rims = useMemo(() => svgPath(POT_RIMS), [])
  const soil = useMemo(() => svgPath(SOIL), [])
  const stems = useMemo(() => svgPath(STEMS), [])
  const leaves = useMemo(() => svgPath(LEAVES), [])
  const spout = useMemo(() => svgPath(SPOUT), [])
  const handle = useMemo(() => svgPath(HANDLE), [])

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y }]}>
      <Rect x={-86} y={0} width={172} height={30}>
        <LinearGradient start={vec(0, 0)} end={vec(0, 30)} colors={[withAlpha('#000000', 0.38), 'transparent']} />
      </Rect>

      {/* The pots and what grows in them. */}
      <Path path={pots}>
        <LinearGradient start={vec(-80, 0)} end={vec(36, 0)} colors={['#b86a3a', '#d8905a', '#a65e30', '#c8804a']} />
      </Path>
      <Path path={rims} color="#c87a48" />
      <Path path={soil} color="#3a2a1a" />
      <Path path={stems} style="stroke" strokeWidth={2.5} strokeCap="round" color="#5a8a3a" />
      <Path path={leaves} color="#7ab04a" />

      {/* The watering can. */}
      <Path path={handle} style="stroke" strokeWidth={4} strokeCap="round" color="#4a6a5a" />
      <Path path={spout} color="#5f7f6f" />
      <Circle cx={33} cy={-72} r={5} color="#4a6a5a" />
      <RoundedRect x={46} y={-56} width={36} height={40} r={4}>
        <LinearGradient start={vec(46, 0)} end={vec(82, 0)} colors={['#6f8a7a', '#4a6a5a']} />
      </RoundedRect>
      <Rect x={46} y={-56} width={36} height={4} color={withAlpha('#9ab0a0', 0.8)} />
      <Rect x={50} y={-50} width={4} height={26} color={withAlpha('#ffffff', 0.2)} />

      {/* The plank and its brackets. */}
      <RoundedRect x={-84} y={-16} width={168} height={16} r={3}>
        <LinearGradient start={vec(0, -16)} end={vec(0, 0)} colors={[PALETTE.beamLight, PALETTE.beam]} />
      </RoundedRect>
      <Rect x={-84} y={-16} width={168} height={3} color={withAlpha('#a87a4a', 0.6)} />
      <Path path={brackets} color={PALETTE.beamDark} />
    </Group>
  )
}
