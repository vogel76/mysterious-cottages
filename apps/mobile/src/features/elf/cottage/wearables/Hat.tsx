import { useMemo } from 'react'
import { Circle, Group, Oval, Path, RoundedRect, rect, vec, type SkPath } from '@shopify/react-native-skia'
import { useDerivedValue } from 'react-native-reanimated'
import { COLORS, SWING, buildPath, n, svg } from '../puppet/geometry'
import type { WearableLayer, WearableProps } from './index'

/* The hats. 'hood' is the elf's classic look: the tunic-coloured hood
   around the head (its circle goes behind the face, the 'back' layer),
   a crescent of shade under the rim, a warm rim light on the fire's side
   and the tip with its pompom swinging from the hood top. Every other hat
   takes the hood off: short warm-brown hair shows under an acorn cap, a
   red mushroom cap with cream dots, a crown of small flowers or a long
   nightcap whose drooping tip swings like the hood's. Each hat is at most
   ten nodes; the swinging parts read the hoodSwing follower. */

export type HatProps = WearableProps & { id: string; layer: WearableLayer }

type HatShapes = {
  acornDome: SkPath
  acornHatch: SkPath
  acornRim: SkPath
  mushroomDome: SkPath
  mushroomDots: SkPath
  crownRing: { x: number; y: number; width: number; height: number }
  petals: SkPath
  petalCentres: SkPath
  nightcapBody: SkPath
  nightcapBand: SkPath
  nightcapTip: SkPath
  nightcapPivot: { x: number; y: number }
  nightcapPompom: { x: number; y: number; r: number }
}

function buildShapes(fx: number, fy: number, cy: number, H: number): HatShapes {
  /* fx, fy: the face's radii; cy: the crown (top of the skull). */
  const acornDome = svg(`M ${n(-1.14 * fx)},${n(cy + 0.5 * fy)} Q 0,${n(cy - 0.78 * fy)} ${n(1.14 * fx)},${n(cy + 0.5 * fy)} Q 0,${n(cy + 0.86 * fy)} ${n(-1.14 * fx)},${n(cy + 0.5 * fy)} Z`)
  const acornHatch = svg(
    `M ${n(-0.9 * fx)},${n(cy + 0.2 * fy)} Q 0,${n(cy - 0.3 * fy)} ${n(0.9 * fx)},${n(cy + 0.2 * fy)} M ${n(-0.6 * fx)},${n(cy - 0.12 * fy)} Q 0,${n(cy - 0.52 * fy)} ${n(0.6 * fx)},${n(cy - 0.12 * fy)} M ${n(-0.5 * fx)},${n(cy + 0.62 * fy)} L ${n(-0.25 * fx)},${n(cy - 0.1 * fy)} M ${n(0.5 * fx)},${n(cy + 0.62 * fy)} L ${n(0.25 * fx)},${n(cy - 0.1 * fy)}`,
  )
  const acornRim = svg(`M ${n(-1.14 * fx)},${n(cy + 0.5 * fy)} Q 0,${n(cy + 0.86 * fy)} ${n(1.14 * fx)},${n(cy + 0.5 * fy)}`)

  const mushroomDome = svg(`M ${n(-1.35 * fx)},${n(cy + 0.55 * fy)} Q ${n(-1.3 * fx)},${n(cy - 0.95 * fy)} 0,${n(cy - 1.0 * fy)} Q ${n(1.3 * fx)},${n(cy - 0.95 * fy)} ${n(1.35 * fx)},${n(cy + 0.55 * fy)} Q 0,${n(cy + 0.75 * fy)} ${n(-1.35 * fx)},${n(cy + 0.55 * fy)} Z`)
  const mushroomDots = buildPath((path) => {
    for (const [dx, dy, r] of [
      [-0.7, -0.25, 0.17],
      [0.15, -0.6, 0.2],
      [0.85, -0.05, 0.15],
      [-0.15, 0.25, 0.11],
      [0.55, 0.4, 0.1],
    ]) {
      path.addCircle(dx * fx, cy + dy * fy, r * fx)
    }
  })

  const ringY = cy + 0.38 * fy
  const crownRing = { x: -1.1 * fx, y: ringY - 0.24 * fy, width: 2.2 * fx, height: 0.48 * fy }
  const flowers: ReadonlyArray<[number, number]> = [
    [-0.95, 0.05],
    [-0.5, -0.15],
    [0, -0.22],
    [0.5, -0.15],
    [0.95, 0.05],
  ]
  const petals = buildPath((path) => {
    for (const [dx, dy] of flowers) {
      for (let petal = 0; petal < 5; petal += 1) {
        const angle = (petal / 5) * Math.PI * 2
        path.addCircle(dx * fx + Math.cos(angle) * 0.1 * fx, ringY + dy * fy + Math.sin(angle) * 0.1 * fx, 0.085 * fx)
      }
    }
  })
  const petalCentres = buildPath((path) => {
    for (const [dx, dy] of flowers) path.addCircle(dx * fx, ringY + dy * fy, 0.07 * fx)
  })

  const apex = { x: 0.15 * fx, y: cy - 0.75 * fy }
  const nightcapBody = svg(`M ${n(-1.12 * fx)},${n(cy + 0.5 * fy)} Q ${n(-0.7 * fx)},${n(cy - 0.55 * fy)} ${n(apex.x)},${n(apex.y)} Q ${n(0.75 * fx)},${n(cy - 0.35 * fy)} ${n(1.12 * fx)},${n(cy + 0.5 * fy)} Q 0,${n(cy + 0.78 * fy)} ${n(-1.12 * fx)},${n(cy + 0.5 * fy)} Z`)
  const nightcapBand = svg(`M ${n(-1.14 * fx)},${n(cy + 0.5 * fy)} Q 0,${n(cy + 0.82 * fy)} ${n(1.14 * fx)},${n(cy + 0.5 * fy)}`)
  const tipEnd = { x: apex.x + 1.45 * fx, y: apex.y + 1.1 * fy }
  const nightcapTip = svg(
    `M ${n(apex.x - 0.22 * fx)},${n(apex.y + 0.25 * fy)} Q ${n(apex.x + 0.9 * fx)},${n(apex.y - 0.45 * fy)} ${n(tipEnd.x)},${n(tipEnd.y)} Q ${n(apex.x + 0.75 * fx)},${n(apex.y + 0.12 * fy)} ${n(apex.x + 0.3 * fx)},${n(apex.y + 0.42 * fy)} Z`,
  )
  const nightcapPompom = { x: tipEnd.x, y: tipEnd.y, r: 0.032 * H }

  return { acornDome, acornHatch, acornRim, mushroomDome, mushroomDots, crownRing, petals, petalCentres, nightcapBody, nightcapBand, nightcapTip, nightcapPivot: apex, nightcapPompom }
}

export function Hat({ id, layer, g, palette, motion }: HatProps) {
  const shapes = useMemo(() => buildShapes(g.faceRx, g.faceRy, g.crown.y, g.H), [g])
  const { hoodSwing } = motion
  const hoodTipTransform = useDerivedValue(() => [{ rotate: hoodSwing.value * SWING.hood }])
  const nightcapTransform = useDerivedValue(() => [{ rotate: hoodSwing.value * SWING.hood * 1.3 }])

  if (id === 'hood') {
    if (layer === 'back') return <Circle cx={g.hood.cx} cy={g.hood.cy} r={g.hood.r} color={palette.tunic} />
    return (
      <>
        <Path path={g.hoodRimShade} color={COLORS.shadow} opacity={0.22} />
        <Path path={g.hoodRimLight} color={COLORS.rimLight} style="stroke" strokeWidth={g.strokeTrim * 0.7} strokeCap="round" opacity={0.45} />
        <Group transform={hoodTipTransform} origin={vec(g.hoodPivot.x, g.hoodPivot.y)}>
          <Path path={g.hoodTip} color={palette.tunic} />
          <Circle cx={g.pompom.x} cy={g.pompom.y} r={g.pompom.r} color={palette.trim} />
        </Group>
      </>
    )
  }

  if (layer === 'back') return null

  const hair = <Path path={g.hairCap} color={COLORS.hair} />

  switch (id) {
    case 'acornCap':
      return (
        <>
          {hair}
          <Path path={shapes.acornDome} color={COLORS.acornCap} />
          <Path path={shapes.acornHatch} color={COLORS.leatherLight} style="stroke" strokeWidth={g.strokeThin * 0.8} strokeCap="round" opacity={0.7} />
          <Path path={shapes.acornRim} color={COLORS.leatherLight} style="stroke" strokeWidth={g.strokeThin * 1.4} strokeCap="round" />
          {/* The stalk grows from the dome's real top: the quadratic's peak
              sits at a fifth of its control point's lift, not at the point. */}
          <RoundedRect x={-0.012 * g.H} y={g.crown.y - 0.14 * g.faceRy - 0.05 * g.H} width={0.024 * g.H} height={0.06 * g.H} r={0.01 * g.H} color={COLORS.acornCap} transform={[{ rotate: 0.25 }]} origin={vec(0, g.crown.y - 0.14 * g.faceRy)} />
        </>
      )
    case 'mushroomCap':
      return (
        <>
          {hair}
          <Path path={shapes.mushroomDome} color={COLORS.mushroom} />
          <Path path={shapes.mushroomDots} color={COLORS.cream} />
          <Oval rect={rect(-0.9 * g.faceRx, g.crown.y - 0.75 * g.faceRy, 0.5 * g.faceRx, 0.3 * g.faceRy)} color={COLORS.highlight} opacity={0.3} transform={[{ rotate: 0.35 }]} origin={vec(-0.65 * g.faceRx, g.crown.y - 0.6 * g.faceRy)} />
        </>
      )
    case 'flowerCrown':
      return (
        <>
          {hair}
          <Oval rect={rect(shapes.crownRing.x, shapes.crownRing.y, shapes.crownRing.width, shapes.crownRing.height)} color={COLORS.leaf} style="stroke" strokeWidth={g.strokeThin * 1.3} />
          <Path path={shapes.petals} color={COLORS.petalPink} />
          <Path path={shapes.petalCentres} color={palette.trim} />
        </>
      )
    case 'nightcap':
      return (
        <>
          {hair}
          <Path path={shapes.nightcapBody} color={COLORS.cream} />
          <Group transform={nightcapTransform} origin={vec(shapes.nightcapPivot.x, shapes.nightcapPivot.y)}>
            <Path path={shapes.nightcapTip} color={COLORS.cream} />
            <Circle cx={shapes.nightcapPompom.x} cy={shapes.nightcapPompom.y} r={shapes.nightcapPompom.r} color={palette.trim} />
          </Group>
          <Path path={shapes.nightcapBand} color={palette.trim} style="stroke" strokeWidth={g.strokeTrim * 1.2} strokeCap="round" />
        </>
      )
    default:
      return null
  }
}
