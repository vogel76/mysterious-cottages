import { useMemo } from 'react'
import { BlurMask, Circle, Group, LinearGradient, Path, Rect, RoundedRect, vec } from '@shopify/react-native-skia'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { PALETTE, svgPath } from '../draw'
import type { FireMotion } from '../Fireplace'

/* The default of the shelf slot: a short oak shelf on two brackets between
   the window and the hearth, with a row of old books (one leaning on its
   neighbour) and a round potion flask whose green liquid gives off its own
   faint light. The anchor is the middle of the plank's underside. */

const BOOKS: ReadonlyArray<{ x: number; w: number; h: number; color: string; spine: string }> = [
  { x: -72, w: 22, h: 72, color: '#7a3a3a', spine: '#a85050' },
  { x: -48, w: 18, h: 64, color: '#3f5a7a', spine: '#5a7a9a' },
  { x: -28, w: 26, h: 80, color: '#4a6a4a', spine: '#6a8a6a' },
  { x: 0, w: 20, h: 60, color: '#b98f4e', spine: '#d2a64d' },
]

/* The tallest book's top to the brackets' tips, the plank's shadow at the sides. */
export const SHELF_BOOKS_BOUNDS = { x: -86, y: -98, width: 174, height: 128 }

export function ShelfBooks({ slot }: { slot: Slot; fire: FireMotion }) {
  const brackets = useMemo(() => svgPath('M -70 0 L -58 0 L -58 26 Z M 70 0 L 58 0 L 58 26 Z'), [])
  const leaning = useMemo(() => svgPath('M 22 -16 L 40 -16 L 54 -82 L 36 -82 Z'), [])

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y }]}>
      <Rect x={-86} y={0} width={172} height={30}>
        <LinearGradient start={vec(0, 0)} end={vec(0, 30)} colors={[withAlpha('#000000', 0.38), 'transparent']} />
      </Rect>
      {BOOKS.map((book) => (
        <Group key={book.x}>
          <RoundedRect x={book.x} y={-16 - book.h} width={book.w} height={book.h} r={2} color={book.color} />
          <Rect x={book.x + 3} y={-16 - book.h + 8} width={book.w - 6} height={3} color={withAlpha(book.spine, 0.9)} />
          <Rect x={book.x + 3} y={-16 - book.h + 16} width={book.w - 6} height={2} color={withAlpha(book.spine, 0.7)} />
          <Rect x={book.x + book.w - 5} y={-16 - book.h} width={5} height={book.h} color={withAlpha('#ffffff', 0.12)} />
        </Group>
      ))}
      <Path path={leaning} color="#5a4a7a" />
      <Rect x={28} y={-74} width={16} height={3} color={withAlpha('#9a8aba', 0.8)} transform={[{ skewX: -0.22 }]} />

      {/* The flask and its glow. */}
      <Circle cx={66} cy={-38} r={30} color={withAlpha('#9af08f', 0.35)}>
        <BlurMask blur={16} style="normal" />
      </Circle>
      <Circle cx={66} cy={-38} r={22}>
        <LinearGradient start={vec(44, -60)} end={vec(88, -16)} colors={['#c8ffb8', '#6fcf6a', '#2f7a3a']} positions={[0, 0.4, 1]} />
      </Circle>
      <Rect x={59} y={-74} width={14} height={18} color={withAlpha('#dfeee0', 0.75)} />
      <RoundedRect x={57} y={-84} width={18} height={12} r={3} color="#8a6238" />
      <Circle cx={58} cy={-46} r={5} color={withAlpha('#ffffff', 0.55)} />

      {/* The plank and its brackets. */}
      <RoundedRect x={-84} y={-16} width={168} height={16} r={3}>
        <LinearGradient start={vec(0, -16)} end={vec(0, 0)} colors={[PALETTE.beamLight, PALETTE.beam]} />
      </RoundedRect>
      <Rect x={-84} y={-16} width={168} height={3} color={withAlpha('#a87a4a', 0.6)} />
      <Path path={brackets} color={PALETTE.beamDark} />
    </Group>
  )
}
