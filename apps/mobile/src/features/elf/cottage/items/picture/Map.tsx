import { useMemo } from 'react'
import { Circle, DashPathEffect, Group, Line, LinearGradient, Path, Rect, RoundedRect, vec } from '@shopify/react-native-skia'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { PALETTE, svgPath } from '../draw'
import type { FireMotion } from '../Fireplace'

/* A parchment map of the trail in a plain oak frame: a few hills in the
   corner, a river, a wood of round trees, the dotted route from a cottage
   to a cottage and a compass rose, hung from a nail on a loop of string
   like the painting it replaces. The anchor is the middle of the frame's
   bottom edge. */

const HILLS = 'M -46 -58 L -36 -78 L -26 -58 Z M -32 -58 L -20 -82 L -8 -58 Z M -14 -58 L -4 -74 L 6 -58 Z'
const RIVER = 'M 44 -86 C 36 -70 48 -62 38 -48 C 28 -34 40 -26 30 -14'
const TREES = [-40, -30, -18, -34, -22].map((x, i) => `M ${x - 5} ${-30 + (i % 2) * -8} a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0 Z`).join(' ')
const TRAIL = 'M -40 -22 C -20 -30 -10 -50 8 -46 C 24 -42 20 -70 36 -78'
const COTTAGES = 'M -46 -18 h 10 v -6 l -5 -5 l -5 5 Z M 32 -72 h 10 v -6 l -5 -5 l -5 5 Z'
const ROSE = 'M 0 -13 L 3 -3 L 13 0 L 3 3 L 0 13 L -3 3 L -13 0 L -3 -3 Z'

/* The nail at the top, the frame's drop shadow at the right and bottom. */
export const PICTURE_MAP_BOUNDS = { x: -66, y: -137, width: 136, height: 141 }

export function PictureMap({ slot }: { slot: Slot; fire: FireMotion }) {
  const hills = useMemo(() => svgPath(HILLS), [])
  const river = useMemo(() => svgPath(RIVER), [])
  const trees = useMemo(() => svgPath(TREES), [])
  const trail = useMemo(() => svgPath(TRAIL), [])
  const cottages = useMemo(() => svgPath(COTTAGES), [])
  const rose = useMemo(() => svgPath(ROSE), [])

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y }]}>
      <Line p1={vec(-52, -104)} p2={vec(0, -132)} strokeWidth={2} color="#2a2a2e" />
      <Line p1={vec(52, -104)} p2={vec(0, -132)} strokeWidth={2} color="#2a2a2e" />
      <Circle cx={0} cy={-133} r={4} color="#55555c" />

      {/* A plain frame on a parchment sheet. */}
      <RoundedRect x={-66} y={-106} width={132} height={106} r={4} color={withAlpha('#000000', 0.3)} transform={[{ translateX: 3 }, { translateY: 4 }]} />
      <RoundedRect x={-66} y={-106} width={132} height={106} r={4}>
        <LinearGradient start={vec(-66, 0)} end={vec(66, 0)} colors={[PALETTE.beam, PALETTE.beamLight, PALETTE.beam]} />
      </RoundedRect>
      <Rect x={-56} y={-96} width={112} height={86}>
        <LinearGradient start={vec(-56, -96)} end={vec(56, -10)} colors={['#efe2bc', '#dcc48f', '#c9ad74']} />
      </Rect>

      {/* The land: hills, a wood, the river, the route between two cottages. */}
      <Path path={hills} color={withAlpha('#7a6a50', 0.8)} />
      <Path path={trees} color="#5f7a45" />
      <Path path={river} style="stroke" strokeWidth={3} strokeCap="round" color="#6a8aa0" />
      <Path path={trail} style="stroke" strokeWidth={2.5} strokeCap="round" color="#7a3a2a">
        <DashPathEffect intervals={[4, 5]} />
      </Path>
      <Path path={cottages} color={PALETTE.beamDark} />

      {/* The compass rose in the lower right. */}
      <Group transform={[{ translateX: 36 }, { translateY: -28 }]}>
        <Path path={rose} color={PALETTE.beam} />
        <Circle cx={0} cy={0} r={2.5} color={PALETTE.accent} />
      </Group>
      <Rect x={-56} y={-96} width={112} height={86} style="stroke" strokeWidth={2} color={withAlpha('#5a3b22', 0.5)} />
    </Group>
  )
}
