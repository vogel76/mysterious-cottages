import { useMemo } from 'react'
import { BlurMask, DashPathEffect, Group, LinearGradient, Oval, Path, RoundedRect, vec } from '@shopify/react-native-skia'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { PALETTE, buildPath, svgPath } from '../draw'
import type { FireMotion } from '../Fireplace'

/* A wicker basket of acorns beside the hearth, the elf's larder and the
   default of the basket slot: a woven body with a rolled rim and a bent
   handle, and a heap of brown acorns in their caps spilling over the top.
   The acorns are one path under one gradient and the weave two paths (the
   plain rows and the dashed ones), so the heap and the body are a few
   nodes. The anchor is the floor under the middle of the basket. */

export const BASKET_ACORNS_BOUNDS = { x: -60, y: -132, width: 120, height: 150 } as const

const ACORNS: ReadonlyArray<{ x: number; y: number; r: number }> = [
  { x: -30, y: -84, r: 12 },
  { x: -6, y: -92, r: 13 },
  { x: 20, y: -84, r: 12 },
  { x: -18, y: -72, r: 11 },
  { x: 8, y: -74, r: 11 },
  { x: 34, y: -70, r: 10 },
]

export function BasketAcorns({ slot }: { slot: Slot; fire: FireMotion }) {
  const body = useMemo(() => svgPath('M -50 -72 L -44 0 L 44 0 L 50 -72 Z'), [])
  const handle = useMemo(() => svgPath('M -34 -74 C -30 -130 30 -130 34 -74'), [])
  const nuts = useMemo(
    () =>
      buildPath((path) => {
        for (const acorn of ACORNS) path.addOval({ x: acorn.x - acorn.r, y: acorn.y - acorn.r, width: acorn.r * 2, height: acorn.r * 2.3 })
      }),
    [],
  )
  const weave = useMemo(
    () => ({
      plain: buildPath((path) => {
        for (const y of [-56, -40, -24, -8]) {
          path.moveTo(-50, y)
          path.lineTo(50, y)
        }
      }),
      dashed: buildPath((path) => {
        for (const y of [-62, -48, -32, -16]) {
          path.moveTo(-50, y)
          path.lineTo(50, y)
        }
      }),
    }),
    [],
  )
  const caps = useMemo(
    () =>
      buildPath((path) => {
        for (const acorn of ACORNS) {
          path.addArc({ x: acorn.x - acorn.r - 1, y: acorn.y - acorn.r - 2, width: acorn.r * 2 + 2, height: acorn.r * 2 }, 180, 180)
          path.lineTo(acorn.x - acorn.r - 1, acorn.y - 2)
          path.close()
        }
      }),
    [],
  )
  const stems = useMemo(
    () =>
      buildPath((path) => {
        for (const acorn of ACORNS) {
          path.moveTo(acorn.x, acorn.y - acorn.r - 2)
          path.lineTo(acorn.x + 3, acorn.y - acorn.r - 9)
        }
      }),
    [],
  )

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y }]}>
      <Oval x={-60} y={-14} width={120} height={32} color={withAlpha('#000000', 0.4)}>
        <BlurMask blur={10} style="normal" />
      </Oval>
      <Path path={handle} style="stroke" strokeWidth={8} strokeCap="round" color="#7a5230" />

      {/* The acorns, behind the rim: one path, shaded across the heap. */}
      <Path path={nuts}>
        <LinearGradient start={vec(-44, 0)} end={vec(46, 0)} colors={['#5a3620', '#9a6a3a', '#6b4626', '#9a6a3a', '#5a3620']} positions={[0, 0.3, 0.5, 0.75, 1]} />
      </Path>
      <Path path={caps} color="#4a3019" />
      <Path path={stems} style="stroke" strokeWidth={3} strokeCap="round" color="#3a2616" />

      {/* The woven body and the rim. */}
      <Path path={body}>
        <LinearGradient start={vec(-50, 0)} end={vec(50, 0)} colors={['#8a6238', '#c49a5a', '#9a7040']} positions={[0, 0.6, 1]} />
      </Path>
      <Group clip={body} style="stroke" color={withAlpha(PALETTE.beamDark, 0.45)}>
        <Path path={weave.plain} strokeWidth={3} />
        <Path path={weave.dashed} strokeWidth={4}>
          <DashPathEffect intervals={[9, 7]} phase={4} />
        </Path>
      </Group>
      <RoundedRect x={-54} y={-80} width={108} height={14} r={7}>
        <LinearGradient start={vec(0, -80)} end={vec(0, -66)} colors={['#c49a5a', '#8a6238']} />
      </RoundedRect>
    </Group>
  )
}
