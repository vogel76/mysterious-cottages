import { useMemo } from 'react'
import { BlurMask, Group, LinearGradient, Oval, Path, RoundedRect, Skia, vec, type SkPath } from '@shopify/react-native-skia'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { buildPath, placeMatrix, svgPath } from '../draw'
import type { FireMotion } from '../Fireplace'

/* A potted fern in the front left corner, the default of the fern slot
   and the one green thing in the room: a terracotta pot with a rolled
   rim, dark soil, and a fan of fronds in three greens that spring from
   the soil and curl outward, the front ones drooping over the rim. Each
   frond is the same tapered leaf with notched edges, turned and scaled
   into place; the fronds of one green share a path, and so do their ribs,
   so the whole fan is five nodes. The anchor is the floor under the pot. */

export const FERN_FERN_BOUNDS = { x: -160, y: -290, width: 320, height: 312 } as const

const FRONDS: ReadonlyArray<{ angle: number; scale: number; color: string }> = [
  { angle: -1.25, scale: 0.78, color: '#356b3b' },
  { angle: -0.85, scale: 0.95, color: '#3f7a44' },
  { angle: -0.45, scale: 1.05, color: '#4e8a54' },
  { angle: -0.08, scale: 1.12, color: '#3f7a44' },
  { angle: 0.3, scale: 1.02, color: '#4e8a54' },
  { angle: 0.7, scale: 0.92, color: '#356b3b' },
  { angle: 1.15, scale: 0.8, color: '#3f7a44' },
  { angle: 1.6, scale: 0.62, color: '#2f5f35' },
  { angle: -1.6, scale: 0.6, color: '#2f5f35' },
]

const LEAF =
  'M 0 0 C -6 -14 -14 -20 -12 -34 C -8 -36 -4 -32 -2 -30 C -8 -46 -16 -56 -12 -72 C -8 -72 -4 -66 -2 -62 C -6 -82 -12 -94 -8 -110 C -4 -110 -2 -104 0 -96 C 2 -104 4 -110 8 -110 C 12 -94 6 -82 2 -62 C 4 -66 8 -72 12 -72 C 16 -56 8 -46 2 -30 C 4 -32 8 -36 12 -34 C 14 -20 6 -14 0 0 Z'

/* Where the fronds spring from, and how the back ones are told from the
   ones that droop over the rim. */
const CROWN_Y = -126
const FROND_SCALE = 1.25
const droops = (frond: { angle: number }) => Math.abs(frond.angle) >= 1.3

/* The fronds that pass the filter, one path per green, in the fan's order. */
function frondPaths(leaf: SkPath, pick: (frond: { angle: number }) => boolean): Array<{ color: string; path: SkPath }> {
  const greens = [...new Set(FRONDS.filter(pick).map((frond) => frond.color))]
  return greens.map((color) => ({
    color,
    path: buildPath((path) => {
      for (const frond of FRONDS) {
        if (!pick(frond) || frond.color !== color) continue
        path.addPath(leaf, Skia.Matrix(placeMatrix(0, CROWN_Y, frond.angle, frond.scale * FROND_SCALE)))
      }
    }),
  }))
}

export function FernFern({ slot }: { slot: Slot; fire: FireMotion }) {
  const leaf = useMemo(() => svgPath(LEAF), [])
  const back = useMemo(() => frondPaths(leaf, (frond) => !droops(frond)), [leaf])
  const front = useMemo(() => frondPaths(leaf, droops), [leaf])
  const ribs = useMemo(() => {
    const rib = svgPath('M 0 0 L 0 -100')
    return buildPath((path) => {
      for (const frond of FRONDS) {
        if (droops(frond)) continue
        path.addPath(rib, Skia.Matrix(placeMatrix(0, CROWN_Y, frond.angle, frond.scale * FROND_SCALE)))
      }
    })
  }, [])
  const pot = useMemo(() => svgPath('M -50 -112 L -40 0 L 40 0 L 50 -112 Z'), [])
  const potShade = useMemo(() => svgPath('M -36 -90 Q -30 -40 -34 -10'), [])

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y }]}>
      <Oval x={-66} y={-14} width={132} height={36} color={withAlpha('#000000', 0.4)}>
        <BlurMask blur={12} style="normal" />
      </Oval>

      {/* The fronds behind the rim, and their ribs. */}
      {back.map(({ color, path }) => (
        <Path key={color} path={path} color={color} />
      ))}
      <Path path={ribs} style="stroke" strokeWidth={2.5} color={withAlpha('#1f4a26', 0.5)} />

      {/* The pot. */}
      <Path path={pot}>
        <LinearGradient start={vec(-50, 0)} end={vec(50, 0)} colors={['#7a4228', '#b86a3e', '#8a4e2e']} positions={[0, 0.55, 1]} />
      </Path>
      <RoundedRect x={-58} y={-130} width={116} height={24} r={8}>
        <LinearGradient start={vec(-58, 0)} end={vec(58, 0)} colors={['#8a4e2e', '#c47444', '#8a4e2e']} />
      </RoundedRect>
      <Oval x={-48} y={-124} width={96} height={16} color="#2e1e12" />
      <Path path={potShade} style="stroke" strokeWidth={6} strokeCap="round" color={withAlpha('#5a2e18', 0.35)} />

      {/* The fronds that droop over the rim. */}
      {front.map(({ color, path }) => (
        <Path key={color} path={path} color={color} />
      ))}
    </Group>
  )
}
