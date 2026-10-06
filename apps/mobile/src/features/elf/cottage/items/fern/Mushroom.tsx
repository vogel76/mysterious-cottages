import { useMemo } from 'react'
import { BlurMask, Group, LinearGradient, Oval, Path, RoundedRect, vec } from '@shopify/react-native-skia'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { PALETTE, buildPath, svgPath } from '../draw'
import type { FireMotion } from '../Fireplace'

/* A clay pot of tall mushrooms in the front left corner, in place of the
   fern: the same terracotta pot with a rolled rim and dark soil, and a
   cluster of five slim mushrooms of different heights growing out of it,
   cream stems, domed caps in rust and tan with pale spots and a shadowed
   underside. The caps of one colour share a path, as do the stems, the
   spots and the gills. The anchor is the floor under the pot. */

export const FERN_MUSHROOM_BOUNDS = { x: -90, y: -300, width: 180, height: 322 } as const

const MUSHROOMS: ReadonlyArray<{ x: number; height: number; cap: number; shade: number }> = [
  { x: -30, height: 118, cap: 34, shade: 0 },
  { x: 8, height: 160, cap: 40, shade: 1 },
  { x: 36, height: 96, cap: 28, shade: 0 },
  { x: -8, height: 70, cap: 24, shade: 1 },
  { x: 24, height: 52, cap: 20, shade: 0 },
]
const CAP_COLORS = ['#a8522e', '#c48a4a']
const SOIL_Y = -118

export function FernMushroom({ slot }: { slot: Slot; fire: FireMotion }) {
  const pot = useMemo(() => svgPath('M -50 -112 L -40 0 L 40 0 L 50 -112 Z'), [])
  const potShade = useMemo(() => svgPath('M -36 -90 Q -30 -40 -34 -10'), [])
  const stems = useMemo(
    () =>
      buildPath((path) => {
        for (const m of MUSHROOMS) {
          path.addRRect({ rect: { x: m.x - 7, y: SOIL_Y - m.height, width: 14, height: m.height + 6 }, rx: 6, ry: 6 })
        }
      }),
    [],
  )
  const caps = useMemo(
    () =>
      CAP_COLORS.map((_, shade) =>
        buildPath((path) => {
          for (const m of MUSHROOMS) {
            if (m.shade !== shade) continue
            const top = SOIL_Y - m.height
            const half = m.cap / 2
            path.moveTo(m.x - half, top + 4)
            path.cubicTo(m.x - half, top - half * 1.1, m.x + half, top - half * 1.1, m.x + half, top + 4)
            path.cubicTo(m.x + half, top + 12, m.x - half, top + 12, m.x - half, top + 4)
            path.close()
          }
        }),
      ),
    [],
  )
  const gills = useMemo(
    () =>
      buildPath((path) => {
        for (const m of MUSHROOMS) {
          const top = SOIL_Y - m.height
          const half = m.cap / 2
          path.addOval({ x: m.x - half * 0.8, y: top + 2, width: half * 1.6, height: 8 })
        }
      }),
    [],
  )
  const spots = useMemo(
    () =>
      buildPath((path) => {
        for (const m of MUSHROOMS) {
          const top = SOIL_Y - m.height
          const half = m.cap / 2
          path.addCircle(m.x - half * 0.45, top - half * 0.3, half * 0.16)
          path.addCircle(m.x + half * 0.25, top - half * 0.55, half * 0.14)
          path.addCircle(m.x + half * 0.55, top - half * 0.1, half * 0.12)
        }
      }),
    [],
  )

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y }]}>
      <Oval x={-66} y={-14} width={132} height={36} color={withAlpha('#000000', 0.4)}>
        <BlurMask blur={12} style="normal" />
      </Oval>

      {/* The mushrooms, stems first, then the caps over them. */}
      <Path path={stems}>
        <LinearGradient start={vec(-30, 0)} end={vec(40, 0)} colors={['#d8ccae', PALETTE.cream, '#c9b48c']} />
      </Path>
      <Path path={gills} color={withAlpha('#5a3620', 0.5)} />
      <Path path={caps[0]!}>
        <LinearGradient start={vec(0, -290)} end={vec(0, -120)} colors={['#c06238', CAP_COLORS[0]!]} />
      </Path>
      <Path path={caps[1]!}>
        <LinearGradient start={vec(0, -290)} end={vec(0, -120)} colors={['#dca462', CAP_COLORS[1]!]} />
      </Path>
      <Path path={spots} color={withAlpha(PALETTE.cream, 0.85)} />

      {/* The pot. */}
      <Path path={pot}>
        <LinearGradient start={vec(-50, 0)} end={vec(50, 0)} colors={['#7a4228', '#b86a3e', '#8a4e2e']} positions={[0, 0.55, 1]} />
      </Path>
      <RoundedRect x={-58} y={-130} width={116} height={24} r={8}>
        <LinearGradient start={vec(-58, 0)} end={vec(58, 0)} colors={['#8a4e2e', '#c47444', '#8a4e2e']} />
      </RoundedRect>
      <Oval x={-48} y={-124} width={96} height={16} color="#2e1e12" />
      <Path path={potShade} style="stroke" strokeWidth={6} strokeCap="round" color={withAlpha('#5a2e18', 0.35)} />
    </Group>
  )
}
