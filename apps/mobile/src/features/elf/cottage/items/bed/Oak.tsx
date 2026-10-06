import { useMemo } from 'react'
import { BlurMask, Circle, DashPathEffect, Group, LinearGradient, Oval, Path, Rect, RoundedRect, vec } from '@shopify/react-native-skia'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { PALETTE, buildPath } from '../draw'
import type { FireMotion } from '../Fireplace'

/* The elf's little oak bed against the left wall, the default of the bed
   slot: an oak headboard with two turned knobs, a side rail on short legs,
   a plump pillow and a patchwork quilt in plum, rust and moss squares with
   a running stitch between them, turned down at the pillow end. The
   patches of one colour share a path and every stitch line is one dashed
   path, so the quilt is five nodes. It stands a little in front of the
   wall, so its shadow falls on the floor. The anchor is the middle of its
   front edge on the floor. */

export const BED_OAK_BOUNDS = { x: -136, y: -240, width: 272, height: 276 } as const

const QUILT = { x: -116, y: -98, width: 232, height: 66 }
const SQUARE = 29
const SQUARE_COLORS = ['#6b4a7a', '#8a5a5a', '#4e6a6a', '#a8784a']

export function BedOak({ slot }: { slot: Slot; fire: FireMotion }) {
  const patches = useMemo(() => {
    const cols = Math.ceil(QUILT.width / SQUARE)
    const rows = Math.ceil(QUILT.height / SQUARE)
    return SQUARE_COLORS.map((_, shade) =>
      buildPath((path) => {
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            if ((col * 3 + row * 2) % SQUARE_COLORS.length !== shade) continue
            path.addRect({ x: QUILT.x + col * SQUARE, y: QUILT.y + row * SQUARE, width: SQUARE, height: SQUARE })
          }
        }
      }),
    )
  }, [])
  const quilt = useMemo(() => buildPath((path) => path.addRRect({ rect: QUILT, rx: 10, ry: 10 })), [])
  const stitches = useMemo(
    () =>
      buildPath((path) => {
        for (let col = 1; col <= 7; col++) {
          path.moveTo(QUILT.x + col * SQUARE, QUILT.y)
          path.lineTo(QUILT.x + col * SQUARE, QUILT.y + QUILT.height)
        }
        for (const row of [1, 2]) {
          path.moveTo(QUILT.x, QUILT.y + row * SQUARE)
          path.lineTo(QUILT.x + QUILT.width, QUILT.y + row * SQUARE)
        }
      }),
    [],
  )

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y }]}>
      <Oval x={-136} y={-24} width={272} height={60} color={withAlpha('#000000', 0.38)}>
        <BlurMask blur={16} style="normal" />
      </Oval>

      {/* The headboard. */}
      <RoundedRect x={-120} y={-214} width={240} height={150} r={20}>
        <LinearGradient start={vec(-120, 0)} end={vec(120, 0)} colors={[PALETTE.beam, PALETTE.beamLight, PALETTE.beam]} />
      </RoundedRect>
      <RoundedRect x={-104} y={-198} width={208} height={100} r={12} color={withAlpha('#2a1a0c', 0.35)} />
      <RoundedRect x={-98} y={-192} width={196} height={88} r={10}>
        <LinearGradient start={vec(0, -192)} end={vec(0, -104)} colors={['#6b4a2b', '#4a3019']} />
      </RoundedRect>
      <Circle cx={-112} cy={-220} r={14} color={PALETTE.beamLight} />
      <Circle cx={112} cy={-220} r={14} color={PALETTE.beamLight} />
      <Circle cx={-116} cy={-224} r={5} color={withAlpha('#ffffff', 0.18)} />
      <Circle cx={108} cy={-224} r={5} color={withAlpha('#ffffff', 0.18)} />

      {/* The mattress, the pillow and the quilt. */}
      <RoundedRect x={-116} y={-116} width={232} height={70} r={14} color="#d9c8a8" />
      <RoundedRect x={-100} y={-126} width={76} height={36} r={16}>
        <LinearGradient start={vec(0, -126)} end={vec(0, -90)} colors={[PALETTE.cream, '#d4c6a8']} />
      </RoundedRect>
      <Group clip={quilt}>
        {patches.map((path, i) => (
          <Path key={i} path={path} color={SQUARE_COLORS[i]!} />
        ))}
        <Rect x={QUILT.x} y={QUILT.y} width={QUILT.width} height={QUILT.height}>
          <LinearGradient start={vec(0, QUILT.y)} end={vec(0, QUILT.y + QUILT.height)} colors={['transparent', withAlpha('#1a0e06', 0.35)]} />
        </Rect>
        <Path path={stitches} style="stroke" strokeWidth={2} color={withAlpha(PALETTE.cream, 0.5)}>
          <DashPathEffect intervals={[5, 5]} />
        </Path>
      </Group>
      {/* The turned-down edge. */}
      <RoundedRect x={-116} y={-104} width={232} height={18} r={8} color="#e6d8ba" />
      <Rect x={-116} y={-90} width={232} height={4} color={withAlpha('#000000', 0.2)} />

      {/* The side rail and the legs. */}
      <RoundedRect x={-124} y={-40} width={248} height={30} r={6}>
        <LinearGradient start={vec(0, -40)} end={vec(0, -10)} colors={[PALETTE.beamLight, PALETTE.beam]} />
      </RoundedRect>
      <Rect x={-124} y={-40} width={248} height={4} color={withAlpha('#a87a4a', 0.6)} />
      <Rect x={-116} y={-10} width={16} height={10} color={PALETTE.beamDark} />
      <Rect x={100} y={-10} width={16} height={10} color={PALETTE.beamDark} />
    </Group>
  )
}
