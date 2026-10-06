import { useMemo } from 'react'
import { BlurMask, Circle, Group, Image, Line, LinearGradient, Path, Rect, RoundedRect, vec } from '@shopify/react-native-skia'
import { useDerivedValue } from 'react-native-reanimated'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { PALETTE, buildPath, svgPath } from '../draw'
import type { FireMotion } from '../Fireplace'
import { usePainting } from './painting'

/* The classic cottage window and the default of the window slot: a deep
   oak frame with an arched top and a cross of mullions, a sill, a rod
   with two red drapes tied back, and through the glass the night of
   Chatynkowo itself, the app's painting, cropped to the opening and
   dimmed a little so it sits behind the glass instead of on it. Until the
   painting has decoded (or if it never does) the opening shows a plain
   night: a deep blue sky, a moon and a few stars, so the room is never
   left with a hole in the wall. By day (the fire motion's day value, from
   the cottage clock) the glass pales to a cream sky and the night's dim
   lifts, so the view matches the sun the lighting layer casts from it.
   The anchor is the middle of the sill; the opening rises 300 units above
   it and is 220 wide. The moonlight the window spills into the room is
   drawn by the lighting layer, not here. */

/* The cream the sky turns by full day, and the glass's dim by night. */
const DAY_SKY = '#f3e4c2'
const DAY_SKY_OPACITY = 0.55
const NIGHT_DIM = 0.28

const OPENING = { x: -110, y: -320, width: 220, height: 300 }
const FRAME = { x: -132, y: -342, width: 264, height: 342 }

/* The rod with its finials across the top, the sill's shadow at the bottom. */
export const WINDOW_ARCHED_BOUNDS = { x: -201, y: -366, width: 402, height: 404 }

export function WindowArched({ slot, fire }: { slot: Slot; fire: FireMotion }) {
  const painting = usePainting()
  /* Daylight pales the glass; the night's dim fades with it. */
  const { day } = fire
  const daylight = useDerivedValue(() => DAY_SKY_OPACITY * day.value)
  const nightDim = useDerivedValue(() => NIGHT_DIM * (1 - day.value))

  const opening = useMemo(() => svgPath('M -110 -20 L -110 -250 Q -110 -320 0 -320 Q 110 -320 110 -250 L 110 -20 Z'), [])
  const stars = useMemo(
    () =>
      buildPath((path) => {
        for (const [x, y, r] of [
          [-70, -290, 2.2],
          [30, -300, 1.8],
          [80, -262, 2.4],
          [-20, -270, 1.5],
          [60, -220, 1.6],
          [-90, -200, 1.8],
        ] as const) {
          path.addCircle(x, y, r)
        }
      }),
    [],
  )
  const hills = useMemo(() => svgPath('M -110 -60 Q -60 -110 -10 -70 Q 40 -120 110 -80 L 110 -20 L -110 -20 Z'), [])
  const drapes = useMemo(
    () => ({
      left: svgPath('M -168 -352 C -150 -300 -138 -220 -150 -130 C -156 -90 -150 -60 -136 -20 L -176 -20 C -186 -70 -190 -120 -184 -170 C -178 -240 -184 -300 -168 -352 Z'),
      right: svgPath('M 168 -352 C 150 -300 138 -220 150 -130 C 156 -90 150 -60 136 -20 L 176 -20 C 186 -70 190 -120 184 -170 C 178 -240 184 -300 168 -352 Z'),
    }),
    [],
  )

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y }]}>
      {/* The frame, lit from the fire on the right. */}
      <RoundedRect x={FRAME.x} y={FRAME.y} width={FRAME.width} height={FRAME.height} r={16}>
        <LinearGradient start={vec(FRAME.x, 0)} end={vec(FRAME.x + FRAME.width, 0)} colors={[PALETTE.beamDark, PALETTE.beam, PALETTE.beamLight]} positions={[0, 0.6, 1]} />
      </RoundedRect>

      {/* The night outside, behind the glass. */}
      <Group clip={opening}>
        <Rect x={OPENING.x} y={OPENING.y} width={OPENING.width} height={OPENING.height}>
          <LinearGradient start={vec(0, OPENING.y)} end={vec(0, OPENING.y + OPENING.height)} colors={['#070e24', '#142a4c', '#1d3a5a']} positions={[0, 0.6, 1]} />
        </Rect>
        {painting ? (
          <Image image={painting} x={OPENING.x} y={OPENING.y} width={OPENING.width} height={OPENING.height} fit="cover" />
        ) : (
          <Group>
            <Circle cx={-38} cy={-232} r={30} color={withAlpha(PALETTE.moon, 0.5)}>
              <BlurMask blur={18} style="normal" />
            </Circle>
            <Circle cx={-38} cy={-232} r={22} color="#e9f0fb" />
            <Path path={stars} color={withAlpha('#ffffff', 0.85)} />
            <Path path={hills} color="#0b1a2c" />
          </Group>
        )}
        {/* The glass: a dim over the view and a slanted glint. */}
        <Rect x={OPENING.x} y={OPENING.y} width={OPENING.width} height={OPENING.height} color={DAY_SKY} opacity={daylight} />
        <Rect x={OPENING.x} y={OPENING.y} width={OPENING.width} height={OPENING.height} color="#0a1430" opacity={nightDim} />
        <Line p1={vec(-96, -300)} p2={vec(70, -36)} strokeWidth={16} strokeCap="round" color={withAlpha('#ffffff', 0.08)} />
        <Line p1={vec(-60, -306)} p2={vec(90, -70)} strokeWidth={5} strokeCap="round" color={withAlpha('#ffffff', 0.1)} />
      </Group>

      {/* The mullions and the bevel around the opening. */}
      <Rect x={-7} y={OPENING.y} width={14} height={OPENING.height} color={PALETTE.beam} />
      <Rect x={OPENING.x} y={-176} width={OPENING.width} height={14} color={PALETTE.beam} />
      <Rect x={-7} y={OPENING.y} width={4} height={OPENING.height} color={withAlpha(PALETTE.beamLight, 0.6)} />
      <Rect x={OPENING.x} y={-176} width={OPENING.width} height={3} color={withAlpha(PALETTE.beamLight, 0.6)} />
      <Path path={opening} style="stroke" strokeWidth={8} color={PALETTE.beamDark} />

      {/* The sill with its underside and shadow. */}
      <Rect x={-152} y={0} width={304} height={26}>
        <LinearGradient start={vec(0, 0)} end={vec(0, 26)} colors={[PALETTE.beamLight, PALETTE.beam]} />
      </Rect>
      <Rect x={-152} y={26} width={304} height={12} color={PALETTE.beamDark} />
      <Rect x={-152} y={38} width={304} height={40}>
        <LinearGradient start={vec(0, 38)} end={vec(0, 78)} colors={[withAlpha('#000000', 0.35), 'transparent']} />
      </Rect>

      {/* The rod and the drapes. */}
      <Rect x={-190} y={-362} width={380} height={10} color={PALETTE.beamDark} />
      <Circle cx={-192} cy={-357} r={9} color={PALETTE.beamLight} />
      <Circle cx={192} cy={-357} r={9} color={PALETTE.beamLight} />
      <Path path={drapes.left}>
        <LinearGradient start={vec(-186, 0)} end={vec(-136, 0)} colors={['#4a1f1f', '#7a3434', '#5a2626']} />
      </Path>
      <Path path={drapes.right}>
        <LinearGradient start={vec(136, 0)} end={vec(186, 0)} colors={['#6b2f2f', '#8f4040', '#5a2626']} />
      </Path>
      <Rect x={-178} y={-150} width={40} height={14} color={PALETTE.accent} />
      <Rect x={138} y={-150} width={40} height={14} color={PALETTE.accent} />
    </Group>
  )
}
