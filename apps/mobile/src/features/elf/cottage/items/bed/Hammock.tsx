import { useMemo } from 'react'
import { BlurMask, Group, LinearGradient, Oval, Path, RoundedRect, vec } from '@shopify/react-native-skia'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { PALETTE, buildPath, svgPath } from '../draw'
import type { FireMotion } from '../Fireplace'

/* A hammock in place of the oak bed: two turned posts on round feet with
   a rope from each, a canvas sling that sags between them in straw and
   moss stripes, its ends gathered into knots, and a folded blanket lying
   in the dip. The cloth is one path clipped for the stripes, so the whole
   piece is a handful of nodes. The anchor is the middle of its front edge
   on the floor, as for the bed. */

export const BED_HAMMOCK_BOUNDS = { x: -160, y: -250, width: 320, height: 266 } as const

/* The sling: the far edge sags less than the near one, so the cloth shows
   its inside. */
const SLING = 'M -112 -160 C -70 -96 70 -96 112 -160 L 112 -140 C 70 -62 -70 -62 -112 -140 Z'
const POST_L = -138
const POST_R = 138

export function BedHammock({ slot }: { slot: Slot; fire: FireMotion }) {
  const sling = useMemo(() => svgPath(SLING), [])
  const posts = useMemo(
    () =>
      buildPath((path) => {
        for (const x of [POST_L, POST_R]) {
          path.addRRect({ rect: { x: x - 10, y: -236, width: 20, height: 236 }, rx: 6, ry: 6 })
          path.addCircle(x, -238, 13)
        }
      }),
    [],
  )
  const feet = useMemo(
    () =>
      buildPath((path) => {
        for (const x of [POST_L, POST_R]) path.addOval({ x: x - 30, y: -14, width: 60, height: 24 })
      }),
    [],
  )
  const ropes = useMemo(
    () =>
      svgPath(`M ${POST_L} -214 C ${POST_L + 10} -196 -120 -168 -108 -150 M ${POST_R} -214 C ${POST_R - 10} -196 120 -168 108 -150`),
    [],
  )
  const knots = useMemo(
    () =>
      buildPath((path) => {
        path.addCircle(-112, -150, 9)
        path.addCircle(112, -150, 9)
      }),
    [],
  )
  const stripes = useMemo(
    () =>
      buildPath((path) => {
        for (let x = -100; x < 112; x += 44) path.addRect({ x, y: -170, width: 20, height: 120 })
      }),
    [],
  )
  const blanketFold = useMemo(() => svgPath('M -46 -104 C -20 -112 20 -112 46 -104 M -40 -90 C -14 -96 14 -96 40 -90'), [])

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y }]}>
      <Oval x={-150} y={-22} width={300} height={56} color={withAlpha('#000000', 0.36)}>
        <BlurMask blur={16} style="normal" />
      </Oval>

      {/* The posts, their feet and the ropes. */}
      <Path path={feet} color={PALETTE.beamDark} />
      <Path path={posts}>
        <LinearGradient start={vec(-10, 0)} end={vec(10, 0)} colors={[PALETTE.beam, PALETTE.beamLight, PALETTE.beam]} />
      </Path>
      <Path path={ropes} style="stroke" strokeWidth={5} strokeCap="round" color="#c9b48c" />

      {/* The sling with its stripes and its inside shading. */}
      <Group clip={sling}>
        <Path path={sling}>
          <LinearGradient start={vec(0, -160)} end={vec(0, -62)} colors={['#d8c49a', '#b89a66']} />
        </Path>
        <Path path={stripes} color={withAlpha('#4f6b45', 0.75)} />
        <Path path={sling}>
          <LinearGradient start={vec(0, -150)} end={vec(0, -70)} colors={[withAlpha('#1a0e06', 0.3), 'transparent', withAlpha('#1a0e06', 0.2)]} positions={[0, 0.45, 1]} />
        </Path>
      </Group>
      <Path path={sling} style="stroke" strokeWidth={3} color={withAlpha('#5a4a2a', 0.5)} />
      <Path path={knots} color="#b89a66" />

      {/* The folded blanket in the dip. */}
      <RoundedRect x={-50} y={-120} width={100} height={34} r={12}>
        <LinearGradient start={vec(0, -120)} end={vec(0, -86)} colors={['#8a5a5a', '#6b4a7a']} />
      </RoundedRect>
      <Path path={blanketFold} style="stroke" strokeWidth={3} strokeCap="round" color={withAlpha(PALETTE.cream, 0.4)} />
    </Group>
  )
}
