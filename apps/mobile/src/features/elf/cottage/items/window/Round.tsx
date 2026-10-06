import { useMemo } from 'react'
import { BlurMask, Circle, Group, Image, LinearGradient, Path, Rect, vec } from '@shopify/react-native-skia'
import { useDerivedValue } from 'react-native-reanimated'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { PALETTE, buildPath, svgPath } from '../draw'
import type { FireMotion } from '../Fireplace'
import { usePainting } from './painting'

/* A round porthole window: a thick oak ring with a four-spoke frame and a
   hub in the middle, the night of Chatynkowo through the glass (the app's
   painting, cropped to the circle and dimmed), a rod above with two green
   drapes tied back and the same sill the arched window stands on. Until
   the painting has decoded the opening shows a plain night with a moon
   and a few stars; by day (the fire motion's day value) the glass pales
   to a cream sky and the dim lifts. The anchor is the middle of the sill;
   the circle's centre is 170 units above it and its opening 122 units in
   radius. */

/* The cream the sky turns by full day, and the glass's dim by night. */
const DAY_SKY = '#f3e4c2'
const DAY_SKY_OPACITY = 0.55
const NIGHT_DIM = 0.28

const CENTER = { x: 0, y: -170 }
const OPENING_R = 122
const FRAME_R = 150

/* The rod across the top, the sill's shadow at the bottom. */
export const WINDOW_ROUND_BOUNDS = { x: -190, y: -346, width: 380, height: 384 }

export function WindowRound({ slot, fire }: { slot: Slot; fire: FireMotion }) {
  const painting = usePainting()
  /* Daylight pales the glass; the night's dim fades with it. */
  const { day } = fire
  const daylight = useDerivedValue(() => DAY_SKY_OPACITY * day.value)
  const nightDim = useDerivedValue(() => NIGHT_DIM * (1 - day.value))

  const opening = useMemo(() => buildPath((path) => path.addCircle(CENTER.x, CENTER.y, OPENING_R)), [])
  const stars = useMemo(
    () =>
      buildPath((path) => {
        for (const [x, y, r] of [
          [-60, -250, 2.2],
          [24, -262, 1.8],
          [70, -220, 2.4],
          [-20, -230, 1.5],
          [50, -170, 1.6],
          [-80, -160, 1.8],
        ] as const) {
          path.addCircle(x, y, r)
        }
      }),
    [],
  )
  const drapes = useMemo(
    () => ({
      left: svgPath('M -168 -336 C -150 -290 -140 -220 -150 -130 C -156 -90 -150 -60 -136 -20 L -176 -20 C -186 -70 -190 -120 -184 -170 C -178 -240 -184 -290 -168 -336 Z'),
      right: svgPath('M 168 -336 C 150 -290 140 -220 150 -130 C 156 -90 150 -60 136 -20 L 176 -20 C 186 -70 190 -120 184 -170 C 178 -240 184 -290 168 -336 Z'),
    }),
    [],
  )

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y }]}>
      {/* The ring of the frame, lit from the fire on the right. */}
      <Circle cx={CENTER.x} cy={CENTER.y} r={FRAME_R}>
        <LinearGradient start={vec(-FRAME_R, 0)} end={vec(FRAME_R, 0)} colors={[PALETTE.beamDark, PALETTE.beam, PALETTE.beamLight]} positions={[0, 0.6, 1]} />
      </Circle>

      {/* The night outside, behind the glass, and the spokes over it. */}
      <Group clip={opening}>
        <Rect x={-OPENING_R} y={CENTER.y - OPENING_R} width={OPENING_R * 2} height={OPENING_R * 2}>
          <LinearGradient start={vec(0, CENTER.y - OPENING_R)} end={vec(0, CENTER.y + OPENING_R)} colors={['#070e24', '#142a4c', '#1d3a5a']} positions={[0, 0.6, 1]} />
        </Rect>
        {painting ? (
          <Image image={painting} x={-OPENING_R} y={CENTER.y - OPENING_R} width={OPENING_R * 2} height={OPENING_R * 2} fit="cover" />
        ) : (
          <Group>
            <Circle cx={-40} cy={-210} r={26} color={withAlpha(PALETTE.moon, 0.5)}>
              <BlurMask blur={16} style="normal" />
            </Circle>
            <Circle cx={-40} cy={-210} r={19} color="#e9f0fb" />
            <Path path={stars} color={withAlpha('#ffffff', 0.85)} />
          </Group>
        )}
        <Rect x={-OPENING_R} y={CENTER.y - OPENING_R} width={OPENING_R * 2} height={OPENING_R * 2} color={DAY_SKY} opacity={daylight} />
        <Rect x={-OPENING_R} y={CENTER.y - OPENING_R} width={OPENING_R * 2} height={OPENING_R * 2} color="#0a1430" opacity={nightDim} />
        <Rect x={-7} y={CENTER.y - OPENING_R} width={14} height={OPENING_R * 2} color={PALETTE.beam} />
        <Rect x={-OPENING_R} y={CENTER.y - 7} width={OPENING_R * 2} height={14} color={PALETTE.beam} />
      </Group>
      <Circle cx={CENTER.x} cy={CENTER.y} r={13} color={PALETTE.beamLight} />
      <Circle cx={CENTER.x} cy={CENTER.y} r={OPENING_R + 4} style="stroke" strokeWidth={8} color={PALETTE.beamDark} />

      {/* The sill with its underside and shadow. */}
      <Rect x={-152} y={0} width={304} height={26}>
        <LinearGradient start={vec(0, 0)} end={vec(0, 26)} colors={[PALETTE.beamLight, PALETTE.beam]} />
      </Rect>
      <Rect x={-152} y={26} width={304} height={12} color={PALETTE.beamDark} />
      <Rect x={-152} y={38} width={304} height={40}>
        <LinearGradient start={vec(0, 38)} end={vec(0, 78)} colors={[withAlpha('#000000', 0.35), 'transparent']} />
      </Rect>

      {/* The rod and the green drapes. */}
      <Rect x={-190} y={-346} width={380} height={10} color={PALETTE.beamDark} />
      <Path path={drapes.left}>
        <LinearGradient start={vec(-186, 0)} end={vec(-136, 0)} colors={['#1f3a24', '#3a6a3e', '#2a4a2c']} />
      </Path>
      <Path path={drapes.right}>
        <LinearGradient start={vec(136, 0)} end={vec(186, 0)} colors={['#2f5a33', '#4a7a4a', '#2a4a2c']} />
      </Path>
      <Rect x={-178} y={-150} width={40} height={14} color={PALETTE.accent} />
      <Rect x={138} y={-150} width={40} height={14} color={PALETTE.accent} />
    </Group>
  )
}
