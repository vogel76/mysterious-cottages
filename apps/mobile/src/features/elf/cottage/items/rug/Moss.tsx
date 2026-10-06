import { useMemo } from 'react'
import { BlurMask, Group, Oval, Path, RadialGradient, vec } from '@shopify/react-native-skia'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { PALETTE, buildPath } from '../draw'
import type { FireMotion } from '../Fireplace'

/* A soft patch of moss in place of the rug, as if the forest floor had
   crept in under the elf: a wide low mound in two greens whose edge fades
   into the planks, little tufts standing up along it, three small
   red-capped mushrooms with pale spots on the far side and a few grey
   pebbles sunk in the front. The anchor is the centre of the patch, which
   is also the elf's feet. */

export const RUG_MOSS_BOUNDS = { x: -310, y: -140, width: 620, height: 264 } as const

const MUSHROOMS: ReadonlyArray<{ x: number; y: number; scale: number }> = [
  { x: -236, y: -64, scale: 1 },
  { x: -206, y: -48, scale: 0.72 },
  { x: 228, y: -70, scale: 0.86 },
]

const PEBBLES: ReadonlyArray<{ x: number; y: number; rx: number; ry: number }> = [
  { x: -120, y: 74, rx: 22, ry: 12 },
  { x: 160, y: 82, rx: 18, ry: 10 },
  { x: 196, y: 70, rx: 12, ry: 7 },
  { x: 40, y: 96, rx: 14, ry: 8 },
]

export function RugMoss({ slot }: { slot: Slot; fire: FireMotion }) {
  const tufts = useMemo(
    () =>
      buildPath((path) => {
        for (let i = 0; i < 26; i++) {
          const angle = (i / 26) * Math.PI * 2
          const x = Math.cos(angle) * 268
          const y = Math.sin(angle) * 92
          const lean = Math.cos(angle) * 6
          path.moveTo(x - 7, y + 2)
          path.quadTo(x + lean, y - 20, x + 7, y + 2)
          path.close()
        }
      }),
    [],
  )
  const stems = useMemo(
    () =>
      buildPath((path) => {
        for (const m of MUSHROOMS) {
          path.addRRect({ rect: { x: m.x - 8 * m.scale, y: m.y - 44 * m.scale, width: 16 * m.scale, height: 44 * m.scale }, rx: 6 * m.scale, ry: 6 * m.scale })
        }
      }),
    [],
  )
  const caps = useMemo(
    () =>
      buildPath((path) => {
        for (const m of MUSHROOMS) {
          const s = m.scale
          path.moveTo(m.x - 30 * s, m.y - 40 * s)
          path.cubicTo(m.x - 30 * s, m.y - 78 * s, m.x + 30 * s, m.y - 78 * s, m.x + 30 * s, m.y - 40 * s)
          path.cubicTo(m.x + 30 * s, m.y - 32 * s, m.x - 30 * s, m.y - 32 * s, m.x - 30 * s, m.y - 40 * s)
          path.close()
        }
      }),
    [],
  )
  const spots = useMemo(
    () =>
      buildPath((path) => {
        for (const m of MUSHROOMS) {
          const s = m.scale
          path.addCircle(m.x - 12 * s, m.y - 56 * s, 4 * s)
          path.addCircle(m.x + 8 * s, m.y - 64 * s, 3.5 * s)
          path.addCircle(m.x + 16 * s, m.y - 48 * s, 3 * s)
        }
      }),
    [],
  )
  const pebbles = useMemo(
    () =>
      buildPath((path) => {
        for (const p of PEBBLES) path.addOval({ x: p.x - p.rx, y: p.y - p.ry, width: p.rx * 2, height: p.ry * 2 })
      }),
    [],
  )
  const pebbleLights = useMemo(
    () =>
      buildPath((path) => {
        for (const p of PEBBLES) path.addOval({ x: p.x - p.rx * 0.6, y: p.y - p.ry * 0.9, width: p.rx * 0.9, height: p.ry * 0.7 })
      }),
    [],
  )

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y }]}>
      <Oval x={-300} y={-96} width={600} height={220} color={withAlpha('#000000', 0.3)}>
        <BlurMask blur={16} style="normal" />
      </Oval>

      {/* The mound: a darker ground, a lit crown, and the tufts along its rim. */}
      <Oval x={-300} y={-110} width={600} height={220}>
        <RadialGradient c={vec(0, 0)} r={300} colors={['#4a6a3c', '#3c5a32', withAlpha('#2f4a28', 0)]} positions={[0, 0.78, 1]} />
      </Oval>
      <Oval x={-220} y={-86} width={440} height={150}>
        <RadialGradient c={vec(-30, -20)} r={220} colors={['#6a9450', withAlpha('#55803f', 0)]} />
      </Oval>
      <Path path={tufts} color="#5d8a44" />

      {/* The mushrooms on the far side. */}
      <Path path={stems} color="#e8dcc0" />
      <Path path={caps} color="#b23b2e" />
      <Path path={spots} color={PALETTE.cream} />

      {/* The pebbles sunk in the front. */}
      <Path path={pebbles} color="#8a857c" />
      <Path path={pebbleLights} color={withAlpha('#ffffff', 0.22)} />

      {/* The far-edge shading and the hearth glow, as on the braided rug. */}
      <Oval x={-300} y={-110} width={600} height={220}>
        <RadialGradient c={vec(0, 30)} r={300} colors={['transparent', withAlpha('#0e1a0a', 0.35)]} positions={[0.55, 1]} />
      </Oval>
      <Oval x={-300} y={-110} width={600} height={220} opacity={0.5} blendMode="overlay">
        <RadialGradient c={vec(140, 0)} r={320} colors={[withAlpha(PALETTE.fire, 0.4), 'transparent']} />
      </Oval>
    </Group>
  )
}
