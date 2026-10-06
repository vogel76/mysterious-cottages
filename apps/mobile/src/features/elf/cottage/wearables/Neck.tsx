import { useMemo } from 'react'
import { Circle, Group, Oval, Path, RadialGradient, rect, vec, type SkPath } from '@shopify/react-native-skia'
import { useDerivedValue } from 'react-native-reanimated'
import { COLORS, n, svg } from '../puppet/geometry'
import type { WearableProps } from './index'

/* What goes around the neck, drawn after the torso: a scarf in the trim
   colour whose knotted tail lags behind the body through the hood's
   follower, or an amulet on a cord with a small acorn that glows softly
   with the breath. 'none' draws nothing. */

export type NeckwearProps = WearableProps & { id: string }

type NeckShapes = {
  band: SkPath
  knot: { x: number; y: number }
  tail: SkPath
  fringe: SkPath
  cord: SkPath
  acorn: { x: number; y: number }
  acornCap: SkPath
}

function buildShapes(bw: number, top: number, H: number): NeckShapes {
  const band = svg(`M ${n(-0.24 * bw)},${n(top + 0.005 * H)} Q 0,${n(top + 0.07 * H)} ${n(0.24 * bw)},${n(top + 0.005 * H)}`)
  const knot = { x: 0.2 * bw, y: top + 0.03 * H }
  const tail = svg(
    `M ${n(knot.x - 0.03 * H)},${n(knot.y)} Q ${n(knot.x + 0.015 * H)},${n(knot.y + 0.1 * H)} ${n(knot.x + 0.005 * H)},${n(knot.y + 0.18 * H)} L ${n(knot.x + 0.065 * H)},${n(knot.y + 0.17 * H)} Q ${n(knot.x + 0.06 * H)},${n(knot.y + 0.08 * H)} ${n(knot.x + 0.03 * H)},${n(knot.y)} Z`,
  )
  const fringe = svg(
    `M ${n(knot.x + 0.012 * H)},${n(knot.y + 0.175 * H)} L ${n(knot.x + 0.008 * H)},${n(knot.y + 0.205 * H)} M ${n(knot.x + 0.035 * H)},${n(knot.y + 0.172 * H)} L ${n(knot.x + 0.035 * H)},${n(knot.y + 0.205 * H)} M ${n(knot.x + 0.058 * H)},${n(knot.y + 0.17 * H)} L ${n(knot.x + 0.062 * H)},${n(knot.y + 0.2 * H)}`,
  )
  const cord = svg(`M ${n(-0.13 * bw)},${n(top + 0.005 * H)} Q 0,${n(top + 0.11 * H)} ${n(0.13 * bw)},${n(top + 0.005 * H)}`)
  const acorn = { x: 0, y: top + 0.1 * H }
  const acornCap = svg(`M ${n(acorn.x - 0.028 * H)},${n(acorn.y - 0.012 * H)} Q ${n(acorn.x)},${n(acorn.y - 0.045 * H)} ${n(acorn.x + 0.028 * H)},${n(acorn.y - 0.012 * H)} Q ${n(acorn.x)},${n(acorn.y)} ${n(acorn.x - 0.028 * H)},${n(acorn.y - 0.012 * H)} Z M ${n(acorn.x)},${n(acorn.y - 0.038 * H)} L ${n(acorn.x + 0.006 * H)},${n(acorn.y - 0.055 * H)}`)
  return { band, knot, tail, fringe, cord, acorn, acornCap }
}

export function Neckwear({ id, g, palette, motion }: NeckwearProps) {
  const shapes = useMemo(() => buildShapes(g.bodyW, g.bodyTop, g.H), [g])
  const { hoodSwing, breath } = motion
  const tailTransform = useDerivedValue(() => [{ rotate: hoodSwing.value * 0.3 }])
  const glowOpacity = useDerivedValue(() => 0.35 + 0.45 * breath.value)

  switch (id) {
    case 'scarf':
      return (
        <>
          <Path path={shapes.band} color={palette.trim} style="stroke" strokeWidth={0.05 * g.H} strokeCap="round" />
          <Group transform={tailTransform} origin={vec(shapes.knot.x, shapes.knot.y)}>
            <Path path={shapes.tail} color={palette.trim} />
            <Path path={shapes.fringe} color={palette.trim} style="stroke" strokeWidth={g.strokeThin * 0.8} strokeCap="round" />
          </Group>
          <Circle cx={shapes.knot.x} cy={shapes.knot.y} r={0.024 * g.H} color={palette.trim} />
        </>
      )
    case 'amulet':
      return (
        <>
          <Path path={shapes.cord} color={COLORS.leather} style="stroke" strokeWidth={g.strokeThin * 0.7} />
          <Circle cx={shapes.acorn.x} cy={shapes.acorn.y + 0.01 * g.H} r={0.06 * g.H} opacity={glowOpacity}>
            <RadialGradient c={vec(shapes.acorn.x, shapes.acorn.y + 0.01 * g.H)} r={0.06 * g.H} colors={[palette.glow + 'cc', palette.glow + '00']} />
          </Circle>
          <Oval rect={rect(shapes.acorn.x - 0.022 * g.H, shapes.acorn.y - 0.02 * g.H, 0.044 * g.H, 0.05 * g.H)} color={COLORS.acorn} />
          <Path path={shapes.acornCap} color={COLORS.acornCap} style="stroke" strokeWidth={g.strokeThin} strokeCap="round" strokeJoin="round" />
        </>
      )
    default:
      return null
  }
}
