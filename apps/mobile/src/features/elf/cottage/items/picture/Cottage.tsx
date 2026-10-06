import { useMemo } from 'react'
import { Circle, Group, Line, LinearGradient, Path, Rect, RoundedRect, vec } from '@shopify/react-native-skia'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { PALETTE, svgPath } from '../draw'
import type { FireMotion } from '../Fireplace'

/* The default of the picture slot: a small framed painting above the
   mantel, a cottage on a hill under a moon, in a gilt frame on a cream
   mat, hung from a nail on a loop of string. A picture of a cottage
   inside a cottage, as every storybook room should have. The anchor is
   the middle of the frame's bottom edge. */

/* The nail at the top, the frame's drop shadow at the right and bottom. */
export const PICTURE_COTTAGE_BOUNDS = { x: -66, y: -137, width: 136, height: 141 }

export function PictureCottage({ slot }: { slot: Slot; fire: FireMotion }) {
  const hill = useMemo(() => svgPath('M -48 -16 L -48 -40 Q -20 -56 10 -44 Q 30 -38 48 -46 L 48 -16 Z'), [])
  const roof = useMemo(() => svgPath('M -24 -50 L -8 -70 L 8 -50 Z'), [])
  const chimneySmoke = useMemo(() => svgPath('M 2 -72 q 4 -6 0 -12 q -4 -6 2 -12'), [])

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y }]}>
      <Line p1={vec(-52, -104)} p2={vec(0, -132)} strokeWidth={2} color="#2a2a2e" />
      <Line p1={vec(52, -104)} p2={vec(0, -132)} strokeWidth={2} color="#2a2a2e" />
      <Circle cx={0} cy={-133} r={4} color="#55555c" />

      <RoundedRect x={-66} y={-106} width={132} height={106} r={6} color={withAlpha('#000000', 0.3)} transform={[{ translateX: 3 }, { translateY: 4 }]} />
      <RoundedRect x={-66} y={-106} width={132} height={106} r={6}>
        <LinearGradient start={vec(-66, -106)} end={vec(66, 0)} colors={[PALETTE.beamLight, PALETTE.accent, PALETTE.beamLight]} />
      </RoundedRect>
      <Rect x={-56} y={-96} width={112} height={86} color="#e8dcc0" />
      <Rect x={-48} y={-88} width={96} height={72}>
        <LinearGradient start={vec(0, -88)} end={vec(0, -16)} colors={['#15294a', '#3a5a7a', '#6a8aa0']} />
      </Rect>
      <Circle cx={30} cy={-72} r={7} color="#eef2fa" />
      <Path path={hill} color="#2f5f35" />
      <Path path={hill} color={withAlpha('#000000', 0.25)} transform={[{ translateY: 8 }]} />
      <Rect x={-24} y={-50} width={32} height={22} color="#8a6238" />
      <Path path={roof} color="#4a2e18" />
      <Rect x={-4} y={-68} width={6} height={10} color="#3a2616" />
      <Path path={chimneySmoke} style="stroke" strokeWidth={2} strokeCap="round" color={withAlpha('#ffffff', 0.5)} />
      <Rect x={-16} y={-44} width={7} height={7} color={PALETTE.fireLight} />
      <Rect x={-2} y={-44} width={7} height={7} color={PALETTE.fireLight} />
      <Rect x={-56} y={-96} width={112} height={86} style="stroke" strokeWidth={2} color={withAlpha('#5a3b22', 0.6)} />
    </Group>
  )
}
