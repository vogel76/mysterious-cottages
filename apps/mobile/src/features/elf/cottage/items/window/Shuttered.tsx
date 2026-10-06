import { useMemo } from 'react'
import { BlurMask, Circle, Group, Image, LinearGradient, Path, Rect, RoundedRect, vec } from '@shopify/react-native-skia'
import { useDerivedValue } from 'react-native-reanimated'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { PALETTE, buildPath, svgPath } from '../draw'
import type { FireMotion } from '../Fireplace'
import { usePainting } from './painting'

/* A square cottage window with wooden shutters folded half open against
   the wall on both sides, no curtains, a cross of mullions over the glass
   and a flower box of red geraniums hanging under the sill. The night of
   Chatynkowo (the app's painting) shows through the opening, with a plain
   moonlit night until it has decoded; by day (the fire motion's day
   value) the glass pales to a cream sky and the dim lifts. The anchor is
   the middle of the sill; the opening is 240 units square and ends 20
   above it. */

/* The cream the sky turns by full day, and the glass's dim by night. */
const DAY_SKY = '#f3e4c2'
const DAY_SKY_OPACITY = 0.55
const NIGHT_DIM = 0.28

const OPENING = { x: -120, y: -260, width: 240, height: 240 }
const FRAME = { x: -142, y: -282, width: 284, height: 282 }

/* The slats of both shutters, every 24 units; one path for both. */
const SLATS = [-204, 146]
  .flatMap((x) => Array.from({ length: 11 }, (_, i) => `M ${x} ${-262 + i * 24} h 52`))
  .join(' ')

/* Three clumps of leaves spilling over the box, then the blossoms over them. */
const LEAVES =
  'M -84 10 q -14 -22 6 -30 q 18 -4 20 18 q -4 18 -26 12 Z M -40 2 q 10 -26 30 -20 q 16 10 2 30 q -18 8 -32 -10 Z M 12 8 q 4 -28 26 -24 q 20 8 10 28 q -16 10 -36 -4 Z M 54 12 q -2 -24 20 -26 q 18 6 10 26 q -14 10 -30 0 Z'
const BLOSSOMS = [-74, -58, -24, -6, 26, 44, 68].map((x, i) => `M ${x - 9} ${-6 + (i % 2) * 8} a 9 9 0 1 0 18 0 a 9 9 0 1 0 -18 0 Z`).join(' ')
const CENTERS = [-74, -58, -24, -6, 26, 44, 68].map((x, i) => `M ${x - 2.5} ${-6 + (i % 2) * 8} a 2.5 2.5 0 1 0 5 0 a 2.5 2.5 0 1 0 -5 0 Z`).join(' ')

/* The shutters at the sides, the flower box under the sill. */
export const WINDOW_SHUTTERED_BOUNDS = { x: -210, y: -282, width: 420, height: 352 }

export function WindowShuttered({ slot, fire }: { slot: Slot; fire: FireMotion }) {
  const painting = usePainting()
  /* Daylight pales the glass; the night's dim fades with it. */
  const { day } = fire
  const daylight = useDerivedValue(() => DAY_SKY_OPACITY * day.value)
  const nightDim = useDerivedValue(() => NIGHT_DIM * (1 - day.value))

  const stars = useMemo(
    () =>
      buildPath((path) => {
        for (const [x, y, r] of [
          [-80, -236, 2.2],
          [20, -246, 1.8],
          [90, -210, 2.4],
          [-30, -214, 1.5],
          [60, -150, 1.6],
          [-100, -130, 1.8],
        ] as const) {
          path.addCircle(x, y, r)
        }
      }),
    [],
  )
  const slats = useMemo(() => svgPath(SLATS), [])
  const leaves = useMemo(() => svgPath(LEAVES), [])
  const blossoms = useMemo(() => svgPath(BLOSSOMS), [])
  const centers = useMemo(() => svgPath(CENTERS), [])

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y }]}>
      {/* The shutters, folded back against the wall and lit unevenly. */}
      <RoundedRect x={-210} y={-276} width={64} height={270} r={4}>
        <LinearGradient start={vec(-210, 0)} end={vec(-146, 0)} colors={[PALETTE.beam, PALETTE.beamLight]} />
      </RoundedRect>
      <RoundedRect x={146} y={-276} width={64} height={270} r={4}>
        <LinearGradient start={vec(146, 0)} end={vec(210, 0)} colors={[PALETTE.beamLight, PALETTE.beam]} />
      </RoundedRect>
      <Path path={slats} style="stroke" strokeWidth={3} color={withAlpha(PALETTE.beamDark, 0.7)} />

      {/* The frame, lit from the fire on the right. */}
      <RoundedRect x={FRAME.x} y={FRAME.y} width={FRAME.width} height={FRAME.height} r={10}>
        <LinearGradient start={vec(FRAME.x, 0)} end={vec(FRAME.x + FRAME.width, 0)} colors={[PALETTE.beamDark, PALETTE.beam, PALETTE.beamLight]} positions={[0, 0.6, 1]} />
      </RoundedRect>

      {/* The night outside, behind the glass. */}
      <Group clip={{ x: OPENING.x, y: OPENING.y, width: OPENING.width, height: OPENING.height }}>
        <Rect x={OPENING.x} y={OPENING.y} width={OPENING.width} height={OPENING.height}>
          <LinearGradient start={vec(0, OPENING.y)} end={vec(0, OPENING.y + OPENING.height)} colors={['#070e24', '#142a4c', '#1d3a5a']} positions={[0, 0.6, 1]} />
        </Rect>
        {painting ? (
          <Image image={painting} x={OPENING.x} y={OPENING.y} width={OPENING.width} height={OPENING.height} fit="cover" />
        ) : (
          <Group>
            <Circle cx={-44} cy={-200} r={28} color={withAlpha(PALETTE.moon, 0.5)}>
              <BlurMask blur={16} style="normal" />
            </Circle>
            <Circle cx={-44} cy={-200} r={20} color="#e9f0fb" />
            <Path path={stars} color={withAlpha('#ffffff', 0.85)} />
          </Group>
        )}
        <Rect x={OPENING.x} y={OPENING.y} width={OPENING.width} height={OPENING.height} color={DAY_SKY} opacity={daylight} />
        <Rect x={OPENING.x} y={OPENING.y} width={OPENING.width} height={OPENING.height} color="#0a1430" opacity={nightDim} />
      </Group>

      {/* The mullions and the bevel around the opening. */}
      <Rect x={-7} y={OPENING.y} width={14} height={OPENING.height} color={PALETTE.beam} />
      <Rect x={OPENING.x} y={-147} width={OPENING.width} height={14} color={PALETTE.beam} />
      <Rect x={OPENING.x} y={OPENING.y} width={OPENING.width} height={OPENING.height} style="stroke" strokeWidth={8} color={PALETTE.beamDark} />

      {/* The sill and the flower box hanging under it. */}
      <Rect x={-160} y={0} width={320} height={24}>
        <LinearGradient start={vec(0, 0)} end={vec(0, 24)} colors={[PALETTE.beamLight, PALETTE.beam]} />
      </Rect>
      <Rect x={-160} y={24} width={320} height={10} color={PALETTE.beamDark} />
      <RoundedRect x={-100} y={28} width={200} height={42} r={5}>
        <LinearGradient start={vec(0, 28)} end={vec(0, 70)} colors={[PALETTE.plankLight, PALETTE.plank, PALETTE.beamDark]} />
      </RoundedRect>
      <Path path={leaves} color="#4f7a3a" />
      <Path path={blossoms} color="#c8323a" />
      <Path path={centers} color={PALETTE.fireLight} />
    </Group>
  )
}
