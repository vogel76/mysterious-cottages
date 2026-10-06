import { useMemo } from 'react'
import { Circle, Group, LinearGradient, Oval, Path, RoundedRect, vec, type SkPath } from '@shopify/react-native-skia'
import { useDerivedValue } from 'react-native-reanimated'
import { COLORS, buildPath, n, svg } from '../puppet/geometry'
import type { WearableLayer, WearableProps } from './index'

/* The outfits, which are the torso itself: the tunic in the starter's
   colours with its belt, buckle and collar, a belly highlight and a shade
   under the head is the base, and the other garments dress it further. The
   vest lays two leather panels with buttons over it, the apron hangs a
   cream bib and skirt with a pocket under the belt, the cloak throws a cape
   in the trim colour behind the whole body (the 'back' layer, drawn before
   the legs and arms, swaying a little with the hood) and pins it with a
   clasp at the collar. The torso is drawn inside the puppet's breathing
   group, so everything here breathes with the chest. */

export type GarmentProps = WearableProps & { id: string; layer: WearableLayer }

type GarmentShapes = {
  vestLeft: SkPath
  vestRight: SkPath
  buttons: SkPath
  apron: SkPath
  straps: SkPath
  pocket: { x: number; y: number; width: number; height: number }
  cape: SkPath
  capeEdge: SkPath
  drape: SkPath
}

function buildShapes(bw: number, top: number, bodyH: number, centerY: number, beltY: number, H: number): GarmentShapes {
  const bottom = top + bodyH
  const panel = (side: -1 | 1) => {
    const p = (x: number, y: number) => `${n(side * x)},${n(y)}`
    return svg(`M ${p(0.4 * bw, top + 0.07 * H)} Q ${p(0.47 * bw, centerY)} ${p(0.36 * bw, beltY - 0.015 * H)} L ${p(0.1 * bw, beltY - 0.015 * H)} Q ${p(0.09 * bw, top + 0.14 * H)} ${p(0.17 * bw, top + 0.05 * H)} Z`)
  }
  const buttons = buildPath((path) => {
    path.addCircle(0.17 * bw, top + 0.12 * H, 0.012 * H)
    path.addCircle(0.19 * bw, top + 0.18 * H, 0.012 * H)
    path.addCircle(-0.17 * bw, top + 0.12 * H, 0.012 * H)
    path.addCircle(-0.19 * bw, top + 0.18 * H, 0.012 * H)
  })

  const apron = svg(
    `M ${n(-0.17 * bw)},${n(top + 0.09 * H)} L ${n(0.17 * bw)},${n(top + 0.09 * H)} L ${n(0.19 * bw)},${n(beltY)} Q ${n(0.43 * bw)},${n(beltY + 0.01 * H)} ${n(0.4 * bw)},${n(bottom - 0.03 * H)} Q 0,${n(bottom + 0.02 * H)} ${n(-0.4 * bw)},${n(bottom - 0.03 * H)} Q ${n(-0.43 * bw)},${n(beltY + 0.01 * H)} ${n(-0.19 * bw)},${n(beltY)} Z`,
  )
  const straps = svg(`M ${n(-0.15 * bw)},${n(top + 0.09 * H)} Q ${n(-0.26 * bw)},${n(top + 0.03 * H)} ${n(-0.3 * bw)},${n(top - 0.01 * H)} M ${n(0.15 * bw)},${n(top + 0.09 * H)} Q ${n(0.26 * bw)},${n(top + 0.03 * H)} ${n(0.3 * bw)},${n(top - 0.01 * H)}`)
  const pocket = { x: -0.11 * bw, y: beltY + 0.07 * H, width: 0.22 * bw, height: 0.07 * H }

  const cape = svg(
    `M ${n(-0.3 * bw)},${n(top + 0.01 * H)} Q ${n(-0.78 * bw)},${n(centerY)} ${n(-0.64 * bw)},${n(bottom + 0.07 * H)} Q 0,${n(bottom + 0.12 * H)} ${n(0.64 * bw)},${n(bottom + 0.07 * H)} Q ${n(0.78 * bw)},${n(centerY)} ${n(0.3 * bw)},${n(top + 0.01 * H)} Z`,
  )
  const capeEdge = svg(`M ${n(-0.5 * bw)},${n(top + 0.12 * H)} Q ${n(-0.66 * bw)},${n(centerY + 0.04 * H)} ${n(-0.56 * bw)},${n(bottom + 0.02 * H)} M ${n(0.5 * bw)},${n(top + 0.12 * H)} Q ${n(0.66 * bw)},${n(centerY + 0.04 * H)} ${n(0.56 * bw)},${n(bottom + 0.02 * H)}`)
  const drape = svg(`M ${n(-0.08 * bw)},${n(top - 0.005 * H)} Q ${n(-0.3 * bw)},${n(top + 0.02 * H)} ${n(-0.42 * bw)},${n(top + 0.12 * H)} M ${n(0.08 * bw)},${n(top - 0.005 * H)} Q ${n(0.3 * bw)},${n(top + 0.02 * H)} ${n(0.42 * bw)},${n(top + 0.12 * H)}`)

  return { vestLeft: panel(-1), vestRight: panel(1), buttons, apron, straps, pocket, cape, capeEdge, drape }
}

export function Garment({ id, layer, g, palette, motion }: GarmentProps) {
  const shapes = useMemo(() => buildShapes(g.bodyW, g.bodyTop, g.bodyH, g.bodyCenterY, g.beltY, g.H), [g])
  const { hoodSwing } = motion
  const capeTransform = useDerivedValue(() => [{ rotate: hoodSwing.value * 0.05 }])

  if (layer === 'back') {
    if (id !== 'cloak') return null
    return (
      <Group transform={capeTransform} origin={vec(g.neck.x, g.neck.y)}>
        <Path path={shapes.cape} color={palette.trim} />
        <Path path={shapes.capeEdge} color={COLORS.shadow} style="stroke" strokeWidth={g.strokeThin} strokeCap="round" opacity={0.18} />
      </Group>
    )
  }

  return (
    <>
      <Oval rect={g.bodyRect}>
        <LinearGradient start={vec(0, g.bodyTop)} end={vec(0, g.bodyTop + g.bodyH)} colors={[palette.tunic, palette.shade]} />
      </Oval>
      <Oval rect={g.neckShadeRect} color={COLORS.shadow} opacity={0.2} />
      <Oval rect={g.bellyRect} color={COLORS.highlight} opacity={0.12} />
      {id === 'vest' && (
        <>
          <Path path={shapes.vestLeft} color={COLORS.leather} />
          <Path path={shapes.vestRight} color={COLORS.leather} />
          <Path path={shapes.buttons} color={COLORS.accent} />
        </>
      )}
      {id === 'apron' && <Path path={shapes.apron} color={COLORS.cream} />}
      <Path path={g.belt} color={palette.trim} style="stroke" strokeWidth={0.04 * g.H} strokeCap="round" />
      <Circle cx={g.buckle.x} cy={g.buckle.y} r={0.022 * g.H} color={COLORS.accent} />
      <Path path={g.collar} color={palette.trim} style="stroke" strokeWidth={g.strokeTrim} strokeCap="round" strokeJoin="round" />
      {id === 'apron' && (
        <>
          <RoundedRect x={shapes.pocket.x} y={shapes.pocket.y} width={shapes.pocket.width} height={shapes.pocket.height} r={0.01 * g.H} color={COLORS.creamShade} />
          <Path path={shapes.straps} color={COLORS.cream} style="stroke" strokeWidth={g.strokeThin * 1.6} strokeCap="round" />
        </>
      )}
      {id === 'cloak' && (
        <>
          <Path path={shapes.drape} color={palette.trim} style="stroke" strokeWidth={g.strokeTrim * 1.1} strokeCap="round" />
          <Circle cx={0} cy={g.bodyTop + 0.01 * g.H} r={0.026 * g.H} color={COLORS.accent} />
        </>
      )}
    </>
  )
}
