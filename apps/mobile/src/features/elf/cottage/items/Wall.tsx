import { useMemo } from 'react'
import { Group, LinearGradient, Path, RadialGradient, Rect, vec } from '@shopify/react-native-skia'
import { withAlpha } from '../../../../ui'
import { ROOM } from '../room'
import { PALETTE, buildPath, svgPath } from './draw'

/* The back wall of the cottage: warm plaster dimmed into the night between
   dark oak beams, a heavy one along the top, two uprights near the sides
   and a thin dado rail at hip height. The plaster is gradients only: a
   vignette that pools the dark in the corners, a little more warmth on the
   right, where the fire is, and a few hairline cracks. No procedural noise:
   the canvas redraws every frame for the fire and the puppet, and a
   per-pixel shader over the whole wall would be the costliest node of the
   scene on a 2019 phone (a baked texture can bring grain back later). The
   beams get a lit face and a shadow under them, and a few pegs so they
   look joined rather than painted on. Everything here is static; the
   fire's glow and the moonlight that play over the wall come from the
   lighting layer on top. */

const TOP_BEAM = { y: 40, height: 90 }
const UPRIGHTS = [130, 830]
const UPRIGHT_WIDTH = 40
const DADO = { y: 980, height: 24 }

export function Wall() {
  const pegs = useMemo(
    () =>
      buildPath((path) => {
        for (const x of UPRIGHTS) {
          for (const y of [260, 620, 900]) path.addCircle(x + UPRIGHT_WIDTH / 2, y, 6)
        }
        for (const x of [110, 300, 500, 700, 890]) path.addCircle(x, TOP_BEAM.y + 30, 6)
      }),
    [],
  )

  const cracks = useMemo(
    () =>
      svgPath(
        'M 560 150 q 8 40 -6 80 q -10 30 4 60 M 905 300 q -6 50 8 90 M 95 820 q 10 40 -4 70',
      ),
    [],
  )

  return (
    <Group>
      <Rect x={0} y={0} width={ROOM.width} height={ROOM.floorY}>
        <LinearGradient start={vec(0, 0)} end={vec(0, ROOM.floorY)} colors={['#6e6048', '#9c8a66', '#7a6a50']} positions={[0, 0.45, 1]} />
      </Rect>
      <Rect x={0} y={0} width={ROOM.width} height={ROOM.floorY}>
        <LinearGradient start={vec(0, 0)} end={vec(ROOM.width, 0)} colors={[withAlpha('#4a5a7a', 0.22), 'transparent', withAlpha('#c06a2a', 0.16)]} positions={[0, 0.45, 1]} />
      </Rect>
      <Rect x={0} y={0} width={ROOM.width} height={ROOM.floorY}>
        <RadialGradient c={vec(520, 720)} r={780} colors={['transparent', withAlpha('#140e08', 0.5)]} positions={[0.45, 1]} />
      </Rect>
      <Path path={cracks} style="stroke" strokeWidth={2} strokeCap="round" color={withAlpha('#3a2c1c', 0.35)} />

      {/* The plaster below the dado takes a touch more shadow. */}
      <Rect x={0} y={DADO.y + DADO.height} width={ROOM.width} height={ROOM.floorY - DADO.y - DADO.height} color={withAlpha('#2a1c10', 0.1)} />

      {/* The top beam, its lit face and the shadow it throws. */}
      <Rect x={0} y={TOP_BEAM.y} width={ROOM.width} height={TOP_BEAM.height}>
        <LinearGradient start={vec(0, TOP_BEAM.y)} end={vec(0, TOP_BEAM.y + TOP_BEAM.height)} colors={[PALETTE.beam, PALETTE.beamDark]} />
      </Rect>
      <Rect x={0} y={TOP_BEAM.y} width={ROOM.width} height={6} color={withAlpha(PALETTE.beamLight, 0.6)} />
      <Rect x={0} y={TOP_BEAM.y + TOP_BEAM.height} width={ROOM.width} height={70}>
        <LinearGradient start={vec(0, TOP_BEAM.y + TOP_BEAM.height)} end={vec(0, TOP_BEAM.y + TOP_BEAM.height + 70)} colors={[withAlpha('#000000', 0.38), 'transparent']} />
      </Rect>
      <Rect x={0} y={0} width={ROOM.width} height={TOP_BEAM.y} color={PALETTE.soot} />

      {/* The uprights, lit from the fire side. */}
      {UPRIGHTS.map((x) => (
        <Group key={x}>
          <Rect x={x} y={TOP_BEAM.y + TOP_BEAM.height} width={UPRIGHT_WIDTH} height={ROOM.floorY - TOP_BEAM.y - TOP_BEAM.height}>
            <LinearGradient start={vec(x, 0)} end={vec(x + UPRIGHT_WIDTH, 0)} colors={[PALETTE.beamDark, PALETTE.beam, '#4a3019']} positions={[0, 0.7, 1]} />
          </Rect>
          <Rect x={x + UPRIGHT_WIDTH} y={TOP_BEAM.y + TOP_BEAM.height} width={22} height={ROOM.floorY - TOP_BEAM.y - TOP_BEAM.height}>
            <LinearGradient start={vec(x + UPRIGHT_WIDTH, 0)} end={vec(x + UPRIGHT_WIDTH + 22, 0)} colors={[withAlpha('#000000', 0.3), 'transparent']} />
          </Rect>
        </Group>
      ))}

      {/* The dado rail. */}
      <Rect x={0} y={DADO.y} width={ROOM.width} height={DADO.height}>
        <LinearGradient start={vec(0, DADO.y)} end={vec(0, DADO.y + DADO.height)} colors={[PALETTE.beamLight, PALETTE.beam, PALETTE.beamDark]} />
      </Rect>
      <Rect x={0} y={DADO.y + DADO.height} width={ROOM.width} height={18}>
        <LinearGradient start={vec(0, DADO.y + DADO.height)} end={vec(0, DADO.y + DADO.height + 18)} colors={[withAlpha('#000000', 0.3), 'transparent']} />
      </Rect>

      <Path path={pegs} color="#2a1a0e" />
    </Group>
  )
}
