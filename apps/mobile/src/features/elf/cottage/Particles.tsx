import { Group, Path, Skia, type SkPath } from '@shopify/react-native-skia'
import { useDerivedValue } from 'react-native-reanimated'
import { PARTICLE_KINDS, type Particle, type ParticleKind } from './motion'

/* The pool of particles over the puppet: hearts, sparkles, bubbles, zzz
   and crumbs, one Skia path per particle whose shape and colour follow the
   particle's kind. Position, scale and opacity come straight from the
   shared values the motion hook animates, so a free particle (opacity 0)
   costs one invisible node and nothing per frame. The shapes are a few
   units across, built once, and drawn with even-odd fill so the bubble's
   ring and its highlight come out of one path. Room units, drawn inside
   the scene's room transform. */

export type ParticlesProps = { particles: readonly Particle[] }

function svg(d: string): SkPath {
  return Skia.Path.MakeFromSVGString(d) ?? Skia.Path.Make()
}

/* Shapes centred on the origin, about 26 units across at scale 1. */
const SHAPES: Record<ParticleKind, SkPath> = {
  heart: svg('M 0,10 C -12,0 -14,-12 -6,-13 C -3,-13 0,-10 0,-7 C 0,-10 3,-13 6,-13 C 14,-12 12,0 0,10 Z'),
  sparkle: svg('M 0,-14 Q 2.2,-2.2 14,0 Q 2.2,2.2 0,14 Q -2.2,2.2 -14,0 Q -2.2,-2.2 0,-14 Z'),
  bubble: svg('M 0,-13 A 13,13 0 1,1 0,13 A 13,13 0 1,1 0,-13 Z M 0,-10.5 A 10.5,10.5 0 1,0 0,10.5 A 10.5,10.5 0 1,0 0,-10.5 Z M -5,-7 A 2.4,2.4 0 1,0 -5,-2.2 A 2.4,2.4 0 1,0 -5,-7 Z'),
  zzz: svg('M -9,-9 H 9 V -5 L -2.5,5 H 9 V 9 H -9 V 5 L 2.5,-5 H -9 Z'),
  crumb: svg('M -5,0 A 5,3.4 0 1,0 5,0 A 5,3.4 0 1,0 -5,0 Z'),
}

const COLORS: Record<ParticleKind, string> = {
  heart: '#e86a7a',
  sparkle: '#ffe08a',
  bubble: '#cfe9ff',
  zzz: '#9fc4ff',
  crumb: '#7a5230',
}

const SHAPE_BY_INDEX = PARTICLE_KINDS.map((kind) => SHAPES[kind])
const COLOR_BY_INDEX = PARTICLE_KINDS.map((kind) => COLORS[kind])

function ParticleNode({ particle }: { particle: Particle }) {
  const { x, y, scale, opacity, kind } = particle
  const transform = useDerivedValue(() => [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }])
  const path = useDerivedValue(() => SHAPE_BY_INDEX[Math.round(kind.value)] ?? SHAPE_BY_INDEX[0])
  const color = useDerivedValue(() => COLOR_BY_INDEX[Math.round(kind.value)] ?? COLOR_BY_INDEX[0])
  return (
    <Group transform={transform} opacity={opacity}>
      <Path path={path} color={color} fillType="evenOdd" />
    </Group>
  )
}

export function Particles({ particles }: ParticlesProps) {
  return (
    <>
      {particles.map((particle, index) => (
        <ParticleNode key={index} particle={particle} />
      ))}
    </>
  )
}
