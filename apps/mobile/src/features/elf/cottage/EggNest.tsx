import { useMemo } from 'react'
import { Circle, Group, LinearGradient, Oval, Path, RadialGradient, Skia, rect, vec, type SkPath } from '@shopify/react-native-skia'
import { useDerivedValue } from 'react-native-reanimated'
import type { StarterId } from '../rules'
import type { PuppetMotion } from './motion'

/* The egg before hatching, in its nest on the rug: a bowl of twigs, a big
   cream egg with the starter's trim band and a few dots in its tunic
   colour, and a warm halo behind it whose strength follows the egg's
   warmth and the glow pulse. The egg rocks (tilt) around its base and hops
   (bob) with the same shared values the puppet uses later, so the scene
   does not care which of the two stands at the anchor. Drawn in room units
   from the origin, the base of the egg, upwards. */

export type EggNestProps = {
  starter: StarterId
  /* 0..100 */
  warmth: number
  motion: PuppetMotion
  origin: { x: number; y: number }
}

export const EGG_HIT_BOX = { x: -140, y: -300, width: 280, height: 320 } as const

type EggPalette = { tunic: string; trim: string; glow: string }
const PALETTES: Record<StarterId, EggPalette> = {
  forest: { tunic: '#4e8a54', trim: '#c79a4b', glow: '#9af08f' },
  ember: { tunic: '#e08a3d', trim: '#f4c76b', glow: '#ffb46b' },
  mystic: { tunic: '#6b3fa0', trim: '#c79a4b', glow: '#c39bff' },
}

const COLORS = {
  shell: '#f5ead1',
  shellShade: '#dcc9a3',
  highlight: '#ffffff',
  halo: '#ffd98a',
  nestDark: '#3a2616',
  nestMid: '#5a3b22',
  nestLight: '#7a5230',
  straw: '#a3814a',
  shadow: '#000000',
} as const

/* The egg's silhouette, base at y = -20 (tucked into the nest), top at -280. */
const EGG_WIDTH = 230
const EGG_BASE_Y = -20
const EGG_TOP_Y = -280
/* Where the halo is centred and how far it reaches. */
const HALO = { cx: 0, cy: -150, r: 240 }

function svg(d: string): SkPath {
  return Skia.Path.MakeFromSVGString(d) ?? Skia.Path.Make()
}

type Geometry = {
  egg: SkPath
  band: SkPath
  dots: ReadonlyArray<{ x: number; y: number; r: number }>
  twigsBack: readonly SkPath[]
  twigsFront: readonly SkPath[]
}

function buildGeometry(): Geometry {
  const half = EGG_WIDTH / 2
  const egg = svg(
    `M 0,${EGG_TOP_Y} C ${half * 0.9},${EGG_TOP_Y} ${half},${EGG_TOP_Y + 120} ${half},${EGG_TOP_Y + 175} C ${half},${EGG_BASE_Y - 30} ${half * 0.6},${EGG_BASE_Y} 0,${EGG_BASE_Y} C ${-half * 0.6},${EGG_BASE_Y} ${-half},${EGG_BASE_Y - 30} ${-half},${EGG_TOP_Y + 175} C ${-half},${EGG_TOP_Y + 120} ${-half * 0.9},${EGG_TOP_Y} 0,${EGG_TOP_Y} Z`,
  )
  const bandY = -135
  const band = svg(`M ${-half - 10},${bandY - 18} Q 0,${bandY + 30} ${half + 10},${bandY - 18}`)
  const dots = [
    { x: -62, y: -205, r: 9 },
    { x: 20, y: -228, r: 8 },
    { x: 78, y: -190, r: 7 },
    { x: -70, y: -82, r: 8 },
    { x: 12, y: -62, r: 9 },
    { x: 80, y: -90, r: 7 },
  ]
  /* Twigs: arcs around the bowl, a few behind the egg and more in front. */
  const twigsBack = [
    svg('M -165,-70 Q -120,-120 -40,-105'), //
    svg('M 165,-75 Q 110,-125 30,-100'),
    svg('M -140,-40 Q 0,-130 150,-45'),
  ]
  const twigsFront = [
    svg('M -170,-40 Q -90,20 0,8 Q 90,20 170,-40'), //
    svg('M -150,-20 Q -60,40 40,22'),
    svg('M 150,-25 Q 70,45 -30,28'),
    svg('M -120,-55 Q -20,-10 110,-50'),
    svg('M -60,-5 Q 10,-28 90,-10'),
  ]
  return { egg, band, dots, twigsBack, twigsFront }
}

export function EggNest({ starter, warmth, motion, origin }: EggNestProps) {
  const g = useMemo(buildGeometry, [])
  const palette = PALETTES[starter]
  const { bob, tilt, glow } = motion

  const eggTransform = useDerivedValue(() => [{ translateY: bob.value }, { rotate: tilt.value }])
  const haloOpacity = useDerivedValue(() => (warmth / 100) * (0.35 + 0.5 * glow.value), [warmth])
  const shadowOpacity = useDerivedValue(() => 0.3 * Math.max(0.3, 1 + bob.value / 150))

  return (
    <Group transform={[{ translateX: origin.x }, { translateY: origin.y }]}>
      <Circle cx={HALO.cx} cy={HALO.cy} r={HALO.r} opacity={haloOpacity}>
        <RadialGradient c={vec(HALO.cx, HALO.cy)} r={HALO.r} colors={[COLORS.halo + 'cc', COLORS.halo + '55', COLORS.halo + '00']} positions={[0, 0.5, 1]} />
      </Circle>

      {/* The bowl of the nest. */}
      <Oval rect={rect(-190, -60, 380, 90)} color={COLORS.shadow} opacity={0.25} />
      <Oval rect={rect(-180, -90, 360, 130)}>
        <LinearGradient start={vec(0, -90)} end={vec(0, 40)} colors={[COLORS.nestMid, COLORS.nestDark]} />
      </Oval>
      <Oval rect={rect(-140, -85, 280, 70)} color={COLORS.nestDark} />
      {g.twigsBack.map((twig, index) => (
        <Path key={index} path={twig} color={COLORS.nestLight} style="stroke" strokeWidth={9} strokeCap="round" />
      ))}

      {/* The egg rocks around its base and hops. */}
      <Group transform={eggTransform} origin={vec(0, EGG_BASE_Y)}>
        <Oval rect={rect(-EGG_WIDTH / 2 - 8, EGG_BASE_Y - 16, EGG_WIDTH + 16, 32)} color={COLORS.shadow} opacity={shadowOpacity} />
        <Path path={g.egg}>
          <LinearGradient start={vec(-EGG_WIDTH / 2, EGG_TOP_Y)} end={vec(EGG_WIDTH / 2, EGG_BASE_Y)} colors={[COLORS.shell, COLORS.shell, COLORS.shellShade]} positions={[0, 0.45, 1]} />
        </Path>
        <Group clip={g.egg}>
          <Path path={g.band} color={palette.trim} style="stroke" strokeWidth={26} />
          {g.dots.map((dot, index) => (
            <Circle key={index} cx={dot.x} cy={dot.y} r={dot.r} color={palette.tunic} />
          ))}
        </Group>
        <Oval rect={rect(-78, -252, 44, 70)} color={COLORS.highlight} opacity={0.35} transform={[{ rotate: 0.35 }]} origin={vec(-56, -217)} />
      </Group>

      {/* The front rim of the nest tucks the egg in. */}
      {g.twigsFront.map((twig, index) => (
        <Path key={index} path={twig} color={index % 2 === 0 ? COLORS.nestLight : COLORS.straw} style="stroke" strokeWidth={index === 0 ? 12 : 8} strokeCap="round" />
      ))}
    </Group>
  )
}
