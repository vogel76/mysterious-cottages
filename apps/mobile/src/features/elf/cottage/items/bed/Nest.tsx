import { useMemo } from 'react'
import { BlurMask, Group, LinearGradient, Oval, Path, Skia, vec } from '@shopify/react-native-skia'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { buildPath, placeMatrix, svgPath } from '../draw'
import type { FireMotion } from '../Fireplace'

/* A big leaf nest in place of the oak bed, the kind a forest elf would
   sleep in: a bowl of twigs with broad leaves laid round it in three
   greens, the front ones overlapping the rim, a dark hollow inside and a
   pillow of pink petals heaped in it. Every leaf is the same shape turned
   and scaled into place and all leaves of one colour share a path. The
   anchor is the middle of its front edge on the floor, as for the bed. */

export const BED_NEST_BOUNDS = { x: -170, y: -190, width: 340, height: 206 } as const

/* One leaf, its stalk at the origin, 90 long along the negative y axis. */
const LEAF = 'M 0 0 C -22 -20 -30 -50 -14 -74 C -8 -84 -3 -88 0 -90 C 3 -88 8 -84 14 -74 C 30 -50 22 -20 0 0 Z'

/* Where each leaf grows from the rim: angle around the bowl, lean and size. */
const LEAVES: ReadonlyArray<{ x: number; y: number; rotate: number; scale: number; shade: number }> = [
  { x: -140, y: -60, rotate: -1.2, scale: 1.1, shade: 0 },
  { x: -100, y: -92, rotate: -0.7, scale: 1.0, shade: 1 },
  { x: -50, y: -110, rotate: -0.3, scale: 1.05, shade: 2 },
  { x: 10, y: -114, rotate: 0.1, scale: 1.1, shade: 1 },
  { x: 70, y: -106, rotate: 0.5, scale: 1.0, shade: 0 },
  { x: 120, y: -86, rotate: 0.9, scale: 1.05, shade: 2 },
  { x: 150, y: -50, rotate: 1.3, scale: 1.0, shade: 1 },
  { x: -120, y: -30, rotate: -1.9, scale: 0.8, shade: 2 },
  { x: -60, y: -18, rotate: -2.6, scale: 0.85, shade: 0 },
  { x: 20, y: -14, rotate: 3.0, scale: 0.9, shade: 1 },
  { x: 90, y: -20, rotate: 2.5, scale: 0.8, shade: 2 },
  { x: 140, y: -36, rotate: 1.9, scale: 0.75, shade: 0 },
]
const GREENS = ['#356b3b', '#4e8a54', '#3f7a44']

const PETALS: ReadonlyArray<{ x: number; y: number; r: number }> = [
  { x: -46, y: -62, r: 16 },
  { x: -18, y: -72, r: 18 },
  { x: 14, y: -68, r: 17 },
  { x: 42, y: -58, r: 15 },
  { x: -30, y: -50, r: 15 },
  { x: 2, y: -52, r: 16 },
  { x: 30, y: -46, r: 14 },
]

export function BedNest({ slot }: { slot: Slot; fire: FireMotion }) {
  const leafShape = useMemo(() => svgPath(LEAF), [])
  const leaves = useMemo(
    () =>
      GREENS.map((_, shade) =>
        buildPath((path) => {
          for (const leaf of LEAVES) {
            if (leaf.shade !== shade) continue
            path.addPath(leafShape, Skia.Matrix(placeMatrix(leaf.x, leaf.y, leaf.rotate, leaf.scale)))
          }
        }),
      ),
    [leafShape],
  )
  const bowl = useMemo(() => svgPath('M -150 -70 C -150 -10 -90 10 0 10 C 90 10 150 -10 150 -70 C 120 -40 60 -30 0 -30 C -60 -30 -120 -40 -150 -70 Z'), [])
  const hollow = useMemo(() => svgPath('M -118 -84 C -80 -56 80 -56 118 -84 C 90 -108 -90 -108 -118 -84 Z'), [])
  const twigs = useMemo(
    () =>
      svgPath(
        'M -136 -56 C -100 -30 -40 -20 20 -24 M -90 -16 C -30 -4 60 -6 120 -30 M 40 -38 C 90 -40 130 -56 146 -72 M -60 -40 C -20 -32 30 -36 80 -50',
      ),
    [],
  )
  const petals = useMemo(
    () =>
      buildPath((path) => {
        for (const petal of PETALS) path.addOval({ x: petal.x - petal.r, y: petal.y - petal.r * 0.7, width: petal.r * 2, height: petal.r * 1.4 })
      }),
    [],
  )
  const petalLights = useMemo(
    () =>
      buildPath((path) => {
        for (const petal of PETALS) path.addOval({ x: petal.x - petal.r * 0.5, y: petal.y - petal.r * 0.55, width: petal.r * 0.7, height: petal.r * 0.4 })
      }),
    [],
  )

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y }]}>
      <Oval x={-160} y={-22} width={320} height={56} color={withAlpha('#000000', 0.38)}>
        <BlurMask blur={16} style="normal" />
      </Oval>

      {/* The back leaves, the hollow and the pillow of petals. */}
      <Path path={leaves[0]!} color={GREENS[0]!} />
      <Path path={leaves[1]!} color={GREENS[1]!} />
      <Path path={hollow} color="#2a1c10" />
      <Path path={petals}>
        <LinearGradient start={vec(0, -90)} end={vec(0, -36)} colors={['#f0a6b4', '#c9707f']} />
      </Path>
      <Path path={petalLights} color={withAlpha('#ffffff', 0.35)} />

      {/* The bowl of twigs and the front leaves over its rim. */}
      <Path path={bowl}>
        <LinearGradient start={vec(0, -70)} end={vec(0, 10)} colors={['#7a5230', '#4a3019']} />
      </Path>
      <Path path={twigs} style="stroke" strokeWidth={4} strokeCap="round" color={withAlpha('#2a1a0c', 0.5)} />
      <Path path={leaves[2]!} color={GREENS[2]!} />
    </Group>
  )
}

/* A place-rotate-scale matrix for a leaf, in the row-major 3x3 form Skia
   takes; each leaf is one matrix and one addPath at mount. */
